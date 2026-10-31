import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  buildImagePrompt,
  geminiApiKey,
  generateBackground,
} from "../gemini.js";
import type { ImageAspect, ImageKind, ImageTextPosition } from "../imageMeta.js";
import type { StyleDesign } from "../styles.js";
import type { VideoStyle } from "../videoStyles.js";
import { HttpError, ensureDir } from "../util.js";
import {
  CHATGPT_IMAGE_MODELS,
  chatgptAccountsKnown,
  chatgptGatewayUsed,
  generateChatgptImage,
} from "./chatgptGateway.js";
import { NOT_INSTALLED_HINT } from "./errors.js";
import { runInGatewayQueue } from "./gatewayQueue.js";
import { generateGeminiWebImage, geminiWebConfigured } from "./geminiWeb.js";
import { coverFit, removeGeminiWatermark } from "./postprocess.js";
import { chatgptGatewayInstalled, gatewayPaths, geminiWebInstalled } from "./runtime.js";

/**
 * MỘT cửa tạo ảnh cho cả hệ thống (docs/EDITOR-V2-PLAN.md §4.5): ảnh minh họa
 * (routes/illustrations.ts), image project (jobs/imageGen.ts), thumbnail,
 * nền auto-cut và cảnh trám của trình chỉnh sửa (routes/generateImage.ts) đều
 * đi qua generateImage(). Ba nhà cung cấp:
 *  - "gemini-api"  - Gemini API (GEMINI_API_KEY), có sẵn từ đầu, tính tiền theo lượt
 *  - "chatgpt-web" - tài khoản ChatGPT web qua gateway chatgpt2api (gateways/chatgpt)
 *  - "gemini-web"  - cookie tài khoản Google qua gemini-webapi (gateways/gemini-web)
 * cộng "auto" = provider mặc định (cấu hình ở trang Kết nối) rồi lần lượt các
 * provider đã cấu hình còn lại.
 *
 * Hai gateway web chạy qua gatewayQueue.ts: từng ảnh một, nghỉ `gatewayDelaySec`
 * giữa hai ảnh (cấu hình ở trang Kết nối) - không bắn liên tục vào tài khoản web.
 *
 * Prompt LUÔN dựng bằng buildImagePrompt (Style Design + phong cách dựng) bất
 * kể provider - đổi nhà cung cấp không được làm ảnh lạc thương hiệu. Ảnh ra
 * LUÔN được cover-fit về đúng kích thước khung (postprocess.ts).
 */

export type ImageProviderId = "gemini-api" | "chatgpt-web" | "gemini-web";
export type ImageProviderChoice = ImageProviderId | "auto";

export const IMAGE_PROVIDER_IDS: readonly ImageProviderId[] = ["gemini-api", "chatgpt-web", "gemini-web"];

export function isImageProviderChoice(v: unknown): v is ImageProviderChoice {
  return v === "auto" || IMAGE_PROVIDER_IDS.includes(v as ImageProviderId);
}

const LABELS: Record<ImageProviderId, string> = {
  "gemini-api": "Gemini API",
  "chatgpt-web": "ChatGPT (tài khoản web)",
  "gemini-web": "Gemini (cookie web)",
};

/** Kích thước khung chuẩn theo tỉ lệ - khớp các preset project (1080x1920, 1920x1080, 1080x1080, 1080x1350) */
export const ASPECT_SIZE: Record<ImageAspect, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
};

/** Tỉ lệ Gemini API gần nhất với một kích thước bất kỳ (API chỉ nhận 4 tỉ lệ này) */
export function nearestAspect(width: number, height: number): ImageAspect {
  const ratio = width / height;
  const options: Array<[ImageAspect, number]> = [
    ["9:16", 9 / 16],
    ["4:5", 4 / 5],
    ["1:1", 1],
    ["16:9", 16 / 9],
  ];
  let best = options[0];
  for (const opt of options) {
    if (Math.abs(opt[1] - ratio) < Math.abs(best[1] - ratio)) best = opt;
  }
  return best[0];
}

// ---------------------------------------------------------------------------
// Cấu hình (apps/server/data/image-providers.json)
// ---------------------------------------------------------------------------

/** Nghỉ giữa hai ảnh liên tiếp trên CÙNG một gateway web (gatewayQueue.ts) */
export const GATEWAY_DELAY_DEFAULT_SEC = 10;
export const GATEWAY_DELAY_MAX_SEC = 600;

function readProvidersFile(): Record<string, unknown> {
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(gatewayPaths.providersFile, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  } catch {
    return {}; // chưa có file
  }
}

function writeProvidersFile(patch: Record<string, unknown>): void {
  ensureDir(path.dirname(gatewayPaths.providersFile));
  // Giữ field lạ (tương lai có thể thêm cấu hình khác vào cùng file)
  const next = { ...readProvidersFile(), ...patch };
  fs.writeFileSync(gatewayPaths.providersFile, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export function readDefaultProvider(): ImageProviderChoice {
  const raw = readProvidersFile().default;
  return isImageProviderChoice(raw) ? raw : "auto";
}

export function writeDefaultProvider(value: ImageProviderChoice): void {
  writeProvidersFile({ default: value });
}

export function isGatewayDelaySec(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= GATEWAY_DELAY_MAX_SEC;
}

export function readGatewayDelaySec(): number {
  const raw = readProvidersFile().gatewayDelaySec;
  return isGatewayDelaySec(raw) ? raw : GATEWAY_DELAY_DEFAULT_SEC;
}

export function writeGatewayDelaySec(value: number): void {
  writeProvidersFile({ gatewayDelaySec: value });
}

// ---------------------------------------------------------------------------
// Trạng thái provider
// ---------------------------------------------------------------------------

/** Đã cấu hình (có key/token/cookie) - rẻ, không gọi mạng, gọi mỗi request được */
export function providerConfigured(id: ImageProviderId): boolean {
  if (id === "gemini-api") return geminiApiKey() !== null;
  if (id === "chatgpt-web") {
    if (!chatgptGatewayInstalled() || !chatgptGatewayUsed()) return false;
    // Số tài khoản dùng được lần gần nhất hỏi gateway (lưu đĩa). Chưa hỏi lần nào
    // = chưa từng thêm tài khoản thành công → chưa cấu hình
    return (chatgptAccountsKnown() ?? 0) > 0;
  }
  return geminiWebInstalled() && geminiWebConfigured();
}

export interface ImageProviderInfo {
  id: ImageProviderId;
  label: string;
  configured: boolean;
  models: string[];
}

export function listImageProviders(): {
  default: ImageProviderChoice;
  gatewayDelaySec: number;
  providers: ImageProviderInfo[];
} {
  return {
    default: readDefaultProvider(),
    gatewayDelaySec: readGatewayDelaySec(),
    providers: IMAGE_PROVIDER_IDS.map((id) => ({
      id,
      label: LABELS[id],
      configured: providerConfigured(id),
      models:
        id === "gemini-api"
          ? IMAGE_MODELS.map((m) => m.id)
          : id === "chatgpt-web"
            ? [...CHATGPT_IMAGE_MODELS]
            : [],
    })),
  };
}

/**
 * Chọn chuỗi provider sẽ thử, theo thứ tự.
 *
 * `provider` (mới, ưu tiên) và `model` (cũ - giữ tương thích): model là id
 * model Gemini API cũ ⇒ provider "gemini-api" với model đó; model mới dạng
 * "chatgpt-web" / "gemini-web" / "gemini-api" / "auto". Không có gì ⇒ "auto".
 * Chọn đích danh một provider thì CHỈ provider đó (không rơi sang cái khác -
 * người dùng chọn ChatGPT mà ra ảnh Gemini là sai ý).
 */
export function resolveProviders(
  provider?: string | null,
  model?: string | null,
): { chain: ImageProviderId[]; geminiModel?: string; explicit: boolean } {
  const m = (model ?? "").trim();
  let choice: ImageProviderChoice = "auto";
  let geminiModel: string | undefined;
  if (provider && isImageProviderChoice(provider)) choice = provider;
  else if (m && isImageProviderChoice(m)) choice = m;
  else if (m) {
    choice = "gemini-api";
    geminiModel = m;
  }
  // provider đích danh + model Gemini cụ thể (vd editor chọn Gemini API, brief có model)
  if (choice === "gemini-api" && !geminiModel && m && !isImageProviderChoice(m)) geminiModel = m;
  if (choice !== "auto") return { chain: [choice], geminiModel, explicit: true };

  const def = readDefaultProvider();
  const order: ImageProviderId[] =
    def === "auto" ? [...IMAGE_PROVIDER_IDS] : [def, ...IMAGE_PROVIDER_IDS.filter((p) => p !== def)];
  return { chain: order.filter(providerConfigured), geminiModel, explicit: false };
}

// ---------------------------------------------------------------------------
// Tạo ảnh
// ---------------------------------------------------------------------------

export interface GenerateImageInput {
  prompt: string;
  kind: ImageKind;
  /** Tỉ lệ dùng cho bố cục prompt + Gemini API. Bỏ trống = suy từ width/height */
  aspect?: ImageAspect;
  /** Kích thước ĐÍCH chính xác (cover-fit). Bỏ trống = theo aspect (ASPECT_SIZE) */
  width?: number;
  height?: number;
  design: StyleDesign;
  /** Đường dẫn tuyệt đối file PNG đầu ra */
  outFile: string;
  /** Provider - xem resolveProviders */
  provider?: string | null;
  /** Model (tương thích ngược) - xem resolveProviders */
  model?: string | null;
  /** Model ảnh khi lượt này chạy bằng ChatGPT web (CHATGPT_IMAGE_MODELS) - bỏ trống = mặc định */
  chatgptModel?: string;
  usageProjectId?: string;
  allowText?: boolean;
  videoStyle?: VideoStyle | null;
  layout?: "poster" | "video";
  subjectPosition?: ImageTextPosition;
  /** Ghi chú tiến độ (vd ctx.log của job) */
  onLog?: (line: string) => void;
  /**
   * Job đã bị hủy chưa. Không cắt ngang được lượt đang vẽ (đã gửi đi là đã tính
   * lượt), nhưng chặn được lượt CHƯA gửi: đang chờ hàng gateway, hoặc sắp thử
   * nhà cung cấp kế tiếp sau khi cái trước lỗi.
   */
  isCanceled?: () => boolean;
}

export interface GenerateImageResult {
  file: string;
  promptUsed: string;
  provider: ImageProviderId;
}

function noProviderError(): HttpError {
  return new HttpError(
    503,
    "NO_IMAGE_PROVIDER",
    "Chưa cấu hình nhà cung cấp tạo ảnh nào. Thêm GEMINI_API_KEY (aistudio.google.com/apikey), " +
      "hoặc nhập tài khoản ChatGPT / cookie Gemini web ở trang Kết nối; hoặc tự upload ảnh.",
  );
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageResult> {
  const { chain, geminiModel, explicit } = resolveProviders(input.provider, input.model);
  if (chain.length === 0) throw noProviderError();
  const target =
    input.width && input.height
      ? { width: Math.round(input.width), height: Math.round(input.height) }
      : ASPECT_SIZE[input.aspect ?? "9:16"];
  const aspect = input.aspect ?? nearestAspect(target.width, target.height);

  const errors: Array<{ provider: ImageProviderId; err: unknown }> = [];
  for (const provider of chain) {
    if (input.isCanceled?.()) throw new Error("Job đã bị hủy");
    try {
      input.onLog?.(`[image] ${provider} ${target.width}x${target.height}`);
      const run = () => generateWith(provider, { ...input, aspect }, target, geminiModel);
      // Gateway web: lần lượt từng ảnh + nghỉ giữa hai ảnh; Gemini API thì chạy thẳng
      const promptUsed =
        provider === "gemini-api"
          ? await run()
          : await runInGatewayQueue(provider, run, {
              delayMs: () => readGatewayDelaySec() * 1000,
              onLog: input.onLog,
              isCanceled: input.isCanceled,
            });
      return { file: input.outFile, promptUsed, provider };
    } catch (err) {
      // Đã hủy thì dừng hẳn - thử nhà cung cấp kế tiếp là tốn thêm một lượt ảnh
      if (input.isCanceled?.()) throw err;
      errors.push({ provider, err });
      input.onLog?.(
        `[image] ${provider} lỗi: ${err instanceof Error ? err.message : String(err)}` +
          (chain.indexOf(provider) < chain.length - 1 ? " - thử nhà cung cấp kế tiếp" : ""),
      );
    }
  }
  if (errors.length === 1 || explicit) throw errors[errors.length - 1].err;
  // Tự động mà tất cả đều hỏng: giữ mã lỗi của cái CUỐI, gộp câu của từng cái
  const last = errors[errors.length - 1].err;
  const message = errors
    .map(({ provider, err }) => `${LABELS[provider]}: ${err instanceof Error ? err.message : String(err)}`)
    .join(" | ");
  if (last instanceof HttpError) throw new HttpError(last.status, last.code, message, last.extra);
  throw new Error(message);
}

async function generateWith(
  provider: ImageProviderId,
  input: GenerateImageInput & { aspect: ImageAspect },
  target: { width: number; height: number },
  geminiModel: string | undefined,
): Promise<string> {
  ensureDir(path.dirname(input.outFile));

  if (provider === "gemini-api") {
    if (!geminiApiKey()) {
      throw new HttpError(
        503,
        "NO_GEMINI_KEY",
        "Chưa có GEMINI_API_KEY. Thêm GEMINI_API_KEY vào .env (hoặc trang Kết nối) - lấy tại aistudio.google.com/apikey; hoặc tự upload nền.",
      );
    }
    const { promptUsed } = await generateBackground({
      ...input,
      aspect: input.aspect,
      model: geminiModel ?? DEFAULT_IMAGE_MODEL,
    });
    try {
      await coverFit(input.outFile, input.outFile, target.width, target.height);
    } catch (err) {
      // Gemini API đã ra đúng tỉ lệ - không có ffmpeg thì giữ ảnh gốc (hành vi cũ)
      input.onLog?.(`[image] bỏ qua cover-fit: ${err instanceof Error ? err.message : String(err)}`);
    }
    return promptUsed;
  }

  const promptUsed = buildImagePrompt(input);
  if (provider === "chatgpt-web") {
    if (!chatgptGatewayInstalled()) {
      throw new HttpError(503, "GATEWAY_NOT_INSTALLED", `Chưa cài gateway ChatGPT. ${NOT_INSTALLED_HINT}`);
    }
    const buf = await generateChatgptImage({
      prompt: promptUsed,
      width: target.width,
      height: target.height,
      model: input.chatgptModel,
      projectId: input.usageProjectId,
    });
    const raw = `${input.outFile}.chatgpt-raw`;
    fs.writeFileSync(raw, buf);
    try {
      await coverFit(raw, input.outFile, target.width, target.height);
    } finally {
      fs.rmSync(raw, { force: true });
    }
    return promptUsed;
  }

  // gemini-web
  if (!geminiWebInstalled()) {
    throw new HttpError(503, "GATEWAY_NOT_INSTALLED", `Chưa cài gateway Gemini web. ${NOT_INSTALLED_HINT}`);
  }
  const raw = await generateGeminiWebImage({
    prompt: promptUsed,
    width: target.width,
    height: target.height,
    outDir: path.dirname(input.outFile),
  });
  try {
    // Gỡ watermark TRƯỚC khi scale - cần đúng pixel gốc
    const wm = await removeGeminiWatermark(raw);
    input.onLog?.(`[image] watermark Gemini: ${wm.removed ? "đã gỡ" : `giữ nguyên (${wm.reason ?? "-"})`}`);
    await coverFit(raw, input.outFile, target.width, target.height);
  } finally {
    fs.rmSync(raw, { force: true });
  }
  return promptUsed;
}
