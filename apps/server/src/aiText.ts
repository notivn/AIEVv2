import { nanoid } from "nanoid";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { hasClaudeAuth, repoRoot } from "./config.js";
import { addTokenUsage } from "./db.js";
import { geminiApiKey } from "./gemini.js";
import { HttpError } from "./util.js";

/**
 * Gọi AI MỘT LƯỢT, KHÔNG tool, không nạp settings/CLAUDE.md - dùng cho các
 * tác vụ sinh văn bản ngắn trong request HTTP (gợi ý clip, metadata đăng bài…).
 * Tách ra từ POST /api/skills/generate để mọi nơi dùng chung một cách tính token.
 *
 * Thang provider: Claude SDK (subscription/key trên máy) → Gemini REST
 * (GEMINI_API_KEY - vốn là yêu cầu có sẵn cho tạo ảnh) → lỗi hướng dẫn rõ.
 * KHÔNG dùng cho việc dựng video: việc đó chạy qua agent.ts (có tool, có phiên).
 */

export interface AiTextResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

/**
 * @param usageTag tiền tố ghi vào token_usage.sessionId (vd "cliphint", "publish")
 * @param projectId gắn usage vào project để Dashboard cộng đúng cột token
 */
export async function generateText(input: {
  prompt: string;
  usageTag: string;
  projectId?: string | null;
  timeoutMs?: number;
  /** Model Claude cụ thể - bỏ trống để dùng mặc định của SDK */
  model?: string | null;
}): Promise<AiTextResult> {
  if (hasClaudeAuth()) return generateTextClaude(input);
  // Máy không có Claude nhưng có key Gemini (cần cho tạo ảnh nên hay có sẵn):
  // one-shot text không cần tool nên Gemini REST gọi thẳng là đủ
  if (geminiApiKey()) return generateTextGemini(input);
  throw new HttpError(
    503,
    "NO_TEXT_AI",
    "Chưa có AI để sinh văn bản: đăng nhập Claude Code trên máy này (lệnh `claude` → /login) HOẶC điền GEMINI_API_KEY vào file .env rồi khởi động lại server.",
  );
}

/** Model text Gemini cho fallback — flash cho rẻ/nhanh, tác vụ đều ngắn */
const GEMINI_TEXT_MODEL = "gemini-2.5-flash";

async function generateTextGemini(input: {
  prompt: string;
  usageTag: string;
  projectId?: string | null;
  timeoutMs?: number;
}): Promise<AiTextResult> {
  const key = geminiApiKey();
  if (!key) throw new HttpError(503, "NO_GEMINI_KEY", "Thiếu GEMINI_API_KEY trong .env");
  const timeoutMs = input.timeoutMs ?? 3 * 60_000;
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${GEMINI_TEXT_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ parts: [{ text: input.prompt }] }] }),
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Gemini API ${res.status}: ${body.slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    try {
      if (inputTokens > 0 || outputTokens > 0) {
        addTokenUsage(
          `${input.usageTag}_${nanoid(8)}`,
          input.projectId ?? null,
          inputTokens,
          outputTokens,
          0,
          "gemini",
        );
      }
    } catch {
      /* usage là phụ */
    }
    return { text, inputTokens, outputTokens, costUsd: 0 };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      500,
      "AI_FAILED",
      `Gọi AI thất bại (Gemini): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function generateTextClaude(input: {
  prompt: string;
  usageTag: string;
  projectId?: string | null;
  timeoutMs?: number;
  /** Model Claude cụ thể - bỏ trống để dùng mặc định của SDK */
  model?: string | null;
}): Promise<AiTextResult> {
  if (!hasClaudeAuth()) {
    throw new HttpError(
      503,
      "NO_CLAUDE_AUTH",
      "Chưa có xác thực Claude. Cách 1 (khuyên dùng): đăng nhập Claude Code trên máy này (VSCode extension hoặc chạy `claude` trong terminal rồi /login) - hệ thống tự dùng gói subscription. Cách 2: điền ANTHROPIC_API_KEY vào file .env rồi khởi động lại server.",
    );
  }

  const timeoutMs = input.timeoutMs ?? 3 * 60_000;
  const options: Record<string, unknown> = {
    cwd: repoRoot,
    maxTurns: 1,
    allowedTools: [],
    settingSources: [],
    permissionMode: "default",
  };
  if (input.model) options.model = input.model;

  let text = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;

  try {
    const q = query({
      prompt: input.prompt,
      options: options as Parameters<typeof query>[0]["options"],
    });

    const run = (async () => {
      for await (const raw of q) {
        const msg = raw as {
          type?: string;
          result?: string;
          total_cost_usd?: number;
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
        };
        if (msg.type === "result") {
          // Cộng cache vào input như agent.ts để Dashboard nhất quán
          inputTokens =
            (msg.usage?.input_tokens ?? 0) +
            (msg.usage?.cache_creation_input_tokens ?? 0) +
            (msg.usage?.cache_read_input_tokens ?? 0);
          outputTokens = msg.usage?.output_tokens ?? 0;
          costUsd = typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : 0;
          if (typeof msg.result === "string") text = msg.result;
        }
      }
    })();
    // Timeout thắng race thì run reject sau đó (do interrupt) - nuốt để không unhandled
    run.catch(() => {});

    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        void q.interrupt().catch(() => {});
        reject(new Error(`Quá ${Math.round(timeoutMs / 60_000)} phút chưa có kết quả`));
      }, timeoutMs);
    });
    try {
      await Promise.race([run, timeout]);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    throw new HttpError(
      500,
      "AI_FAILED",
      `Gọi AI thất bại: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    // Token đã tiêu kể cả khi parse output lỗi - luôn ghi nhận
    try {
      if (inputTokens > 0 || outputTokens > 0 || costUsd > 0) {
        addTokenUsage(
          `${input.usageTag}_${nanoid(8)}`,
          input.projectId ?? null,
          inputTokens,
          outputTokens,
          costUsd,
          "claude",
        );
      }
    } catch {
      /* usage là phụ - không chặn luồng chính */
    }
  }

  return { text, inputTokens, outputTokens, costUsd };
}

/**
 * Lấy JSON từ text AI trả về: ưu tiên fence ```json, sau đó fence trần, cuối
 * cùng là đoạn từ dấu `{`/`[` đầu tiên tới dấu đóng cuối cùng. null nếu không parse được.
 */
export function extractJson<T = unknown>(text: string): T | null {
  const tryParse = (s: string): T | null => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };

  const fenceRe = /```(?:json)?[^\n]*\r?\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(text)) !== null) {
    const parsed = tryParse(m[1].trim());
    if (parsed !== null) return parsed;
  }

  const trimmed = text.trim();
  const direct = tryParse(trimmed);
  if (direct !== null) return direct;

  for (const [open, close] of [
    ["{", "}"],
    ["[", "]"],
  ] as const) {
    const i = trimmed.indexOf(open);
    const j = trimmed.lastIndexOf(close);
    if (i >= 0 && j > i) {
      const parsed = tryParse(trimmed.slice(i, j + 1));
      if (parsed !== null) return parsed;
    }
  }
  return null;
}
