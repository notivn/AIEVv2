import fs from "node:fs";
import path from "node:path";
import { paths, repoRoot } from "../config.js";
import { updateJob } from "../db.js";
import { generateImage } from "../imageProviders/index.js";
import {
  IMAGE_GEN_STEPS,
  imageDirOf,
  readImageMeta,
  writeImageMeta,
  type ImageGenStep,
} from "../imageMeta.js";
import type { JobCtx } from "../queue.js";
import { remotionGlArgs } from "../renderSettings.js";
import { getStyle } from "../styles.js";
import { ensureDir, remotionCli } from "../util.js";
import { parseProgressLine, shortenStep } from "./progress.js";

/**
 * Job "image-gen" - pipeline tạo ảnh của image project (docs/API.md mục Image Projects):
 * - step "background": gọi nhà cung cấp tạo ảnh (imageProviders - Gemini API / ChatGPT
 *   web / Gemini web, prompt trộn Design System) → background.png đúng kích thước tỉ lệ
 * - step "compose": stage nền + logo bằng hardlink vào engines/remotion/public/staging/img-<id>/,
 *   ghi props.json (PosterProps), chạy `npx remotion still Poster` → final.png
 * - step "all": background rồi compose.
 * Step nằm trong cột sceneId của job. Meta status: generating khi chạy, error + message khi fail.
 */
export async function runImageGen(ctx: JobCtx): Promise<void> {
  const id = ctx.job.projectId;
  const rawStep = ctx.job.sceneId ?? "all";
  const step: ImageGenStep = IMAGE_GEN_STEPS.includes(rawStep as ImageGenStep)
    ? (rawStep as ImageGenStep)
    : "all";

  const meta = readImageMeta(id); // ném lỗi rõ nếu image project đã bị xóa
  meta.status = "generating";
  meta.error = null;
  writeImageMeta(id, meta);

  try {
    if (step === "all" || step === "background") await stepBackground(ctx, id);
    if (step === "all" || step === "compose") await stepCompose(ctx, id);

    const done = readImageMeta(id);
    // Chỉ chạy background → chưa có final: quay về draft chờ bước Hoàn thiện
    done.status = step === "background" ? "draft" : "done";
    done.error = null;
    writeImageMeta(id, done);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      const failed = readImageMeta(id);
      failed.status = "error";
      failed.error = message;
      writeImageMeta(id, failed);
    } catch {
      /* image project có thể đã bị xóa giữa chừng */
    }
    throw err;
  }
}

// ---- step background: Gemini tạo ảnh nền -------------------------------

/**
 * Chờ `p` nhưng thoát ngay (ném "Job đã bị hủy") khi job bị hủy. Bước tạo ảnh
 * không có tiến trình con nào để queue kill: không có vòng dò này thì job hủy
 * vẫn chiếm chỗ trong hàng đợi tới khi nhà cung cấp trả ảnh (cả phút với gateway web).
 */
async function orCanceled<T>(p: Promise<T>, ctx: JobCtx): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const canceled = new Promise<never>((_, reject) => {
    timer = setInterval(() => {
      if (ctx.isCanceled()) reject(new Error("Job đã bị hủy"));
    }, 500);
  });
  try {
    return await Promise.race([p, canceled]);
  } finally {
    clearInterval(timer);
  }
}

async function stepBackground(ctx: JobCtx, id: string): Promise<void> {
  const meta = readImageMeta(id);
  const design = getStyle(meta.styleId); // style đã chọn hoặc default

  // meta.model: id model Gemini API (giá trị cũ) hoặc "auto" | "chatgpt-web" |
  // "gemini-web" | "gemini-api" - imageProviders/resolveProviders lo tương thích
  ctx.progress(5, "AI tạo ảnh nền");
  ctx.log(
    `[image] kind=${meta.kind} aspect=${meta.aspect} model=${meta.model ?? "(mặc định)"}` +
      (meta.model === "chatgpt-web" ? ` chatgptModel=${meta.chatgptModel ?? "(mặc định)"}` : ""),
  );
  // Vẽ vào file TẠM của riêng job này rồi mới đổi tên: hủy job không cắt ngang
  // được lượt đang vẽ ở nhà cung cấp, và ảnh về muộn mà ghi thẳng background.png
  // là đè lên nền người dùng vừa tải lên / vừa tạo lại sau khi hủy.
  const bgAbs = path.join(imageDirOf(id), "background.png");
  const tmpAbs = path.join(imageDirOf(id), `background.${ctx.job.id}.tmp.png`);
  const generation = generateImage({
    prompt: meta.prompt,
    kind: meta.kind,
    aspect: meta.aspect,
    design,
    outFile: tmpAbs,
    usageProjectId: id,
    model: meta.model ?? undefined,
    // Chỉ khi chọn đích danh ChatGPT web - xem ImageProject.chatgptModel
    chatgptModel: meta.model === "chatgpt-web" ? (meta.chatgptModel ?? undefined) : undefined,
    onLog: (l) => ctx.log(l),
    isCanceled: () => ctx.isCanceled(),
  });
  let result: Awaited<typeof generation>;
  try {
    result = await orCanceled(generation, ctx);
  } catch (err) {
    // Hủy giữa chừng: lượt vẽ vẫn chạy nền tới khi xong - lúc đó dọn file tạm của nó
    void generation
      .catch(() => undefined)
      .finally(() => fs.rmSync(tmpAbs, { force: true }));
    throw err;
  }
  if (ctx.isCanceled()) {
    fs.rmSync(tmpAbs, { force: true });
    throw new Error("Job đã bị hủy");
  }
  fs.renameSync(tmpAbs, bgAbs);
  ctx.log(`[image] provider=${result.provider} prompt: ${result.promptUsed}`);

  const fresh = readImageMeta(id);
  fresh.background = "background.png";
  writeImageMeta(id, fresh);
  ctx.progress(40, "Đã có ảnh nền");
}

// ---- step compose: Remotion still Poster --------------------------------

async function stepCompose(ctx: JobCtx, id: string): Promise<void> {
  const meta = readImageMeta(id);
  const design = getStyle(meta.styleId); // style đã chọn hoặc default

  // 1. Stage nền + logo bằng hardlink (fallback copy) - cùng cơ chế với assemble
  ctx.progress(45, "Stage asset cho Remotion");
  const stagingId = `img-${id}`;
  const stagingAbs = path.join(paths.stagingDir, stagingId);
  fs.rmSync(stagingAbs, { recursive: true, force: true });
  ensureDir(stagingAbs);

  // prefix theo vai trò (bg-/logo-/font-h-/font-b-) để file trùng basename không đè nhau
  const stage = (srcAbs: string, prefix: string): string => {
    // meta/styles do agent hoặc file trên đĩa cung cấp - chặn đường dẫn thoát khỏi repo
    const resolved = path.resolve(srcAbs);
    if (!resolved.startsWith(path.resolve(repoRoot) + path.sep)) {
      throw new Error(`Đường dẫn "${srcAbs}" nằm ngoài repo - từ chối stage`);
    }
    const name = prefix + path.basename(srcAbs);
    const dstAbs = path.join(stagingAbs, name);
    try {
      fs.linkSync(srcAbs, dstAbs); // hardlink - không tốn dung lượng
    } catch {
      fs.copyFileSync(srcAbs, dstAbs); // fallback (khác ổ đĩa / FS không hỗ trợ)
    }
    const publicRel = `staging/${stagingId}/${name}`;
    ctx.log(`[stage] ${srcAbs} -> ${publicRel}`);
    return publicRel;
  };

  let background: string | null = null;
  if (meta.background) {
    const bgAbs = path.join(imageDirOf(id), meta.background);
    if (fs.existsSync(bgAbs)) background = stage(bgAbs, "bg-");
    else ctx.log(`[warn] Không thấy nền ${meta.background} - dùng nền gradient từ design`);
  }

  let logoFile: string | null = null;
  if (design.logoPath) {
    const logoAbs = path.join(repoRoot, design.logoPath);
    if (fs.existsSync(logoAbs)) logoFile = stage(logoAbs, "logo-");
    else ctx.log(`[warn] Không thấy logo ${design.logoPath} - bỏ qua logo`);
  }

  // Font brand (nếu đã upload trong Design System) - Poster nạp để chữ đúng font
  const stageFont = (rel: string | null, prefix: string): string | null => {
    if (!rel) return null;
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      ctx.log(`[warn] Không thấy font ${rel} - dùng font fallback hệ thống`);
      return null;
    }
    return stage(abs, prefix);
  };
  const fontFiles = {
    heading: stageFont(design.fontFiles.heading, "font-h-"),
    body: stageFont(design.fontFiles.body, "font-b-"),
  };

  // 2. props.json - PosterProps đúng hợp đồng composition `Poster` (docs/API.md)
  const props = {
    aspect: meta.aspect,
    background,
    design: {
      colors: design.colors,
      fonts: design.fonts,
      fontFiles,
      logoFile,
      effects: design.effects,
      // PosterProps giữ field brandName (hợp đồng Remotion) - StyleDesign dùng name
      brandName: design.name,
    },
    overlay: meta.overlay,
  };
  const propsAbs = path.join(imageDirOf(id), "props.json");
  fs.writeFileSync(propsAbs, JSON.stringify(props, null, 2) + "\n", "utf8");
  ctx.log(`[props] Đã ghi ${propsAbs}`);

  // 3. Remotion still
  const outAbs = path.join(imageDirOf(id), "final.png");
  ctx.progress(50, "Remotion render Poster");
  const args = [
    remotionCli(),
    "still",
    "Poster",
    `--props=${propsAbs}`,
    `--output=${outAbs}`,
    ...remotionGlArgs(),
  ];
  await ctx.exec(process.execPath, args, paths.remotionDir, (line) => {
    const pct = parseProgressLine(line);
    if (pct !== null) ctx.progress(50 + pct / 2, shortenStep(line));
  });

  if (!fs.existsSync(outAbs)) {
    throw new Error("Remotion still xong nhưng không thấy file final.png");
  }

  const fresh = readImageMeta(id);
  fresh.final = "final.png";
  writeImageMeta(id, fresh);
  updateJob(ctx.job.id, { outputPath: `image-projects/${id}/final.png` });
}
