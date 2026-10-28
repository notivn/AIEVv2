import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { extractArticleFromUrl } from "../article.js";
import {
  SOURCE_ARTICLE_REL,
  applyBriefPatch,
  briefOf,
  projectDirOf,
  readMeta,
  writeAssetEntry,
  writeMeta,
} from "../meta.js";
import { ensureDir, HttpError } from "../util.js";

/**
 * Nguồn "Link bài viết" của Video Project (cột Nguồn, brief.sourceKind "article").
 * Mount dưới /api/projects.
 *
 * Bóc bài NGAY khi người dùng bấm (không đợi tới lúc AI chạy) để họ thấy trước
 * tiêu đề + độ dài và sửa link nếu trang chặn - cùng bộ bóc với Text to video
 * (article.ts). Bản bóc là một asset thường của project (`assets/source-article.md`):
 * agent đọc nó như mọi asset, người dùng mở/xóa được ở card asset.
 */

const router = Router();

export interface SourceArticleSummary {
  relPath: string;
  title: string;
  url: string;
  chars: number;
  excerpt: string;
}

const articleFileOf = (id: string): string => path.join(projectDirOf(id), ...SOURCE_ARTICLE_REL.split("/"));

/** Tóm tắt bản bóc đang có (đọc lại từ file - file là nguồn sự thật, không có bản sao nào khác) */
export function readSourceArticle(id: string): SourceArticleSummary | null {
  const file = articleFileOf(id);
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const title = (lines[0] ?? "").replace(/^#\s*/, "").trim();
  const url = (lines.find((l) => l.startsWith("- Nguồn: ")) ?? "").slice("- Nguồn: ".length).trim();
  // Thân bài = sau dòng kẻ "---" đầu tiên
  const sep = lines.indexOf("---");
  const body = (sep >= 0 ? lines.slice(sep + 1) : lines.slice(1)).join("\n").trim();
  return {
    relPath: SOURCE_ARTICLE_REL,
    title,
    url,
    chars: body.length,
    excerpt: body.replace(/\s+/g, " ").slice(0, 280),
  };
}

// GET /api/projects/:id/source/article → { article: SourceArticleSummary | null }
router.get("/:id/source/article", (req, res) => {
  readMeta(req.params.id); // 404 nếu không có project
  res.json({ article: readSourceArticle(req.params.id) });
});

// POST /api/projects/:id/source/article {url?} → 201 { article, brief }
// Thiếu url thì dùng link đã lưu trong brief: agent dựng video bóc bài bằng body
// `{}` - agentPolicy chặn mọi lệnh Bash có host ngoài, kể cả URL nằm trong JSON body.
router.post("/:id/source/article", async (req, res) => {
  const id = req.params.id;
  const current = readMeta(id); // 404 sớm
  const body = (req.body ?? {}) as Record<string, unknown>;
  const url =
    (typeof body.url === "string" ? body.url.trim() : "") || briefOf(current).sourceUrl;
  if (!url) throw new HttpError(400, "URL_REQUIRED", "Thiếu link bài viết");
  if (!/^https?:\/\//i.test(url)) {
    throw new HttpError(400, "INVALID_URL", "Link phải bắt đầu bằng http:// hoặc https://");
  }

  const article = await extractArticleFromUrl(url); // 4xx/5xx có hướng dẫn dán tay
  const meta = [
    article.siteName ? `Trang: ${article.siteName}` : "",
    article.byline ? `Tác giả: ${article.byline}` : "",
    article.publishedTime ? `Ngày đăng: ${article.publishedTime}` : "",
  ].filter(Boolean);
  const md = [
    `# ${article.title || "(không có tiêu đề)"}`,
    "",
    `- Nguồn: ${article.canonicalUrl || url}`,
    ...(meta.length ? [`- ${meta.join(" · ")}`] : []),
    ...(article.leadImage ? [`- Ảnh đại diện của bài: ${article.leadImage}`] : []),
    "",
    "---",
    "",
    article.blocks.join("\n\n"),
    "",
  ].join("\n");

  const file = articleFileOf(id);
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, md, "utf8");
  writeAssetEntry(id, path.basename(file), {
    description: `Bài viết nguồn (bóc từ link): ${article.title}`.slice(0, 500),
  });

  // Đọc lại meta NGAY TRƯỚC khi ghi - bóc bài mất vài giây, brief có thể vừa đổi
  const fresh = readMeta(id);
  const brief = applyBriefPatch(briefOf(fresh), { sourceKind: "article", sourceUrl: url });
  fresh.brief = brief;
  writeMeta(id, fresh);

  res.status(201).json({ article: readSourceArticle(id), brief });
});

export default router;
