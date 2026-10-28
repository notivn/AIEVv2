import { Router } from "express";
import { extractJson, generateText } from "../aiText.js";
import { projectExists, readMeta } from "../meta.js";
import { HttpError } from "../util.js";

/**
 * Viết MỘT dòng chữ ngắn để chèn lên video tại một mốc trên timeline của trình
 * chỉnh sửa (chuột phải trên timeline → "Chữ"). Mount dưới /api/projects.
 *
 * Chỉ sinh văn bản và trả về - KHÔNG ghi meta.json: chèn layer chữ là việc của
 * trình chỉnh sửa (một bước hoàn tác, đi qua PUT timeline có phiên bản như mọi
 * thao tác tay khác). Claude một lượt không tool (aiText.ts), không phải agent.
 */

const PROMPT_MAX = 1000;
const CONTEXT_MAX = 1500;
/** Layer chữ trên video là một ý ngắn - dài hơn là thành đoạn văn che hình */
const TEXT_MAX = 160;

const router = Router();

// POST /api/projects/:id/generate-text {prompt, atSec?, context?} → 200 {text}
router.post("/:id/generate-text", async (req, res) => {
  const id = req.params.id;
  if (!projectExists(id)) {
    throw new HttpError(404, "PROJECT_NOT_FOUND", `Không tìm thấy video project "${id}"`);
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) throw new HttpError(400, "PROMPT_REQUIRED", "Thiếu yêu cầu (prompt)");
  if (prompt.length > PROMPT_MAX) {
    throw new HttpError(400, "PROMPT_TOO_LONG", `Yêu cầu tối đa ${PROMPT_MAX} ký tự`);
  }
  if (body.context !== undefined && typeof body.context !== "string") {
    throw new HttpError(400, "INVALID_CONTEXT", "context phải là chuỗi");
  }
  if (body.atSec !== undefined && (typeof body.atSec !== "number" || !Number.isFinite(body.atSec) || body.atSec < 0)) {
    throw new HttpError(400, "INVALID_AT_SEC", "atSec phải là số giây không âm");
  }
  const context = typeof body.context === "string" ? body.context.trim().slice(0, CONTEXT_MAX) : "";
  const atSec = typeof body.atSec === "number" ? body.atSec : null;

  const meta = readMeta(id);

  const lines = [
    "Bạn viết chữ hiển thị (on-screen text) cho một video ngắn. Người dựng đang ở trình chỉnh sửa và muốn chèn MỘT dòng chữ lên video.",
    `Tên video: ${typeof meta.name === "string" && meta.name ? meta.name : id}`,
    atSec !== null ? `Mốc chèn: giây ${atSec.toFixed(1)}` : "",
    context ? `Lời thoại quanh mốc đó:\n"""\n${context}\n"""` : "Không có lời thoại quanh mốc đó.",
    `Yêu cầu của người dựng:\n"""\n${prompt}\n"""`,
    "",
    "Quy tắc:",
    "- Ngôn ngữ: cùng ngôn ngữ với lời thoại (không có lời thoại thì tiếng Việt có dấu đầy đủ), trừ khi yêu cầu nói khác.",
    `- Ngắn, đọc kịp trong 2-3 giây: tối đa ${TEXT_MAX} ký tự, tốt nhất dưới 12 từ. Có thể xuống dòng một lần nếu cần.`,
    "- Không emoji, không hashtag, không dấu ngoặc kép bao quanh, không giải thích.",
    'Trả về DUY NHẤT JSON: {"text": "..."}',
  ].filter((l) => l !== "");

  const ai = await generateText({
    prompt: lines.join("\n"),
    usageTag: "editortext",
    projectId: id,
    timeoutMs: 2 * 60_000,
  });

  const parsed = extractJson<{ text?: unknown }>(ai.text);
  const raw = typeof parsed?.text === "string" ? parsed.text : "";
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/^["“”'\s]+|["“”'\s]+$/g, "")
    .slice(0, TEXT_MAX)
    .trim();
  if (!text) {
    throw new HttpError(
      502,
      "TEXT_PARSE_FAILED",
      `AI không trả về chữ hợp lệ. 200 ký tự đầu: ${ai.text.slice(0, 200)}`,
    );
  }
  res.json({ text });
});

export default router;
