import { type Query } from "@anthropic-ai/claude-agent-sdk";
import { agentEnv, checkAgentToolUse } from "../agentPolicy.js";
import { repoRoot } from "../config.js";
import * as db from "../db.js";
import { readRenderSettings } from "../renderSettings.js";

/**
 * Claude driver — phần Agent SDK tách từ agent.ts (hành vi giữ nguyên 100%):
 * buildClaudeOptions dựng options cho `query()`, consumeClaudeTurn tiêu thụ
 * message stream tới hết lượt. agent.ts giữ orchestration (guard, prompt,
 * snapshot timeline, gate, auto-resume) — phần đó đã engine-agnostic.
 */

/**
 * Tool agent được tự chạy KHÔNG cần hỏi. Pipeline video chạy hoàn toàn cục bộ
 * (ffmpeg/HyperFrames/Remotion) nên KHÔNG có WebFetch/WebSearch: prompt luôn
 * chứa nội dung do người dùng/asset cung cấp (brief, mô tả file, transcript) -
 * để cả Bash lẫn kênh ra mạng là mở đường rò rỉ .env/credentials nếu bị chèn
 * chỉ thị độc (prompt injection). Cần tra cứu web thì làm ở phiên riêng.
 */
export const ALLOWED_TOOLS = [
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Bash",
  "TodoWrite",
  "Skill",
];

/**
 * Phiên DỰNG VIDEO (gate + cap Cấu hình): goal 'final' (làm trọn tới final) hoặc
 * 'draft' (brief.finishMode = "draft" - dừng ở bản draft đã QC, docs/EDITOR-V2-PLAN.md
 * mục 3). Hai loại cùng chạy pipeline dài, chỉ khác điểm dừng.
 */
export function isBuildGoal(goal: string | null | undefined): boolean {
  return goal === "final" || goal === "draft";
}

/** Shape structural tối thiểu của message SDK - tránh gãy build khi type SDK đổi giữa các bản 0.3.x */
interface AgentMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  event?: {
    type?: string;
    delta?: { type?: string; text?: string };
  };
  message?: {
    content?: Array<{ type?: string; name?: string; input?: unknown; text?: string }>;
  };
  result?: string;
  /** Usage trên message result - tên field theo SDK 0.3.x, đọc phòng thủ */
  total_cost_usd?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  input_tokens?: number;
  output_tokens?: number;
  [key: string]: unknown;
}

/** Dựng options cho `query()` - nguyên vẹn từ agent.ts bản gốc */
export function buildClaudeOptions(
  session: db.ChatSessionRow | null | undefined,
  sdkSessionId: string | null,
  sessionId: string,
): Record<string, unknown> {
  const options: Record<string, unknown> = {
    cwd: repoRoot,
    permissionMode: "acceptEdits",
    allowedTools: ALLOWED_TOOLS,
    includePartialMessages: true,
    // Phiên edit goal='final' chạy pipeline dài (transcribe → scene → draft → verify → final)
    // - 100 turn không đủ, lượt kết thúc với subtype != success giữa chừng
    // Trần lượt của phiên dựng video lấy từ Cấu hình (đọc mỗi lần chạy nên đổi
    // là ăn ngay). Phiên chat thường giữ 100 - nó ngắn, không phải chỗ tốn tiền.
    // goal='draft' cùng pipeline (chỉ dừng sớm hơn) nên cùng trần.
    maxTurns: isBuildGoal(session?.goal) ? readRenderSettings().aiMaxTurns : 100,
    settingSources: ["project", "user"],
    systemPrompt: { type: "preset", preset: "claude_code" },
    // Không có kênh ra mạng nào ngoài API cục bộ - xem ALLOWED_TOOLS
    disallowedTools: ["WebFetch", "WebSearch"],
    // Gỡ khóa bí mật (Gemini, AIEV_API_TOKEN...) khỏi môi trường agent: `env`,
    // `printenv`, `node -e process.env` trong Bash không còn gì để rò
    env: agentEnv(),
    // "Bash" trần trong allowedTools nghĩa là allowlist settings.json không giới
    // hạn được lệnh nào - lớp chặn thật nằm ở agentPolicy.ts. Deny của hook thắng
    // mọi luật allow; trả {} = không can thiệp, để luật quyền bình thường quyết.
    hooks: {
      PreToolUse: [
        {
          hooks: [
            async (input: { hook_event_name?: string; tool_name?: string; tool_input?: unknown }) => {
              if (input.hook_event_name !== "PreToolUse" || !input.tool_name) return {};
              const toolInput =
                input.tool_input && typeof input.tool_input === "object"
                  ? (input.tool_input as Record<string, unknown>)
                  : {};
              const reason = checkAgentToolUse(input.tool_name, toolInput);
              if (!reason) return {};
              console.warn(`[agent-policy] chặn ${input.tool_name} (phiên ${sessionId}): ${reason}`);
              return {
                hookSpecificOutput: {
                  hookEventName: "PreToolUse",
                  permissionDecision: "deny",
                  permissionDecisionReason: reason,
                },
              };
            },
          ],
        },
      ],
    },
  };
  if (sdkSessionId) options.resume = sdkSessionId;
  // Model/effort người dùng đã chọn cho phiên (docs/API.md mục AI Providers) - chỉ set khi có
  if (session?.model) options.model = session.model;
  if (session?.effort) options.effort = session.effort;
  return options;
}

export interface ClaudeTurnHooks {
  onText(text: string): void;
  onTool(tool: { name: string; input: unknown }): void;
  onError(error: string): void;
}

export interface ClaudeTurnOutcome {
  /** Text cuối của lượt (result của SDK, hoặc phần đã stream khi lỗi giữa chừng) */
  text: string;
  /** Đã lưu text vào chat_messages bên trong (lượt result bình thường) */
  saved: boolean;
  hadError: boolean;
  /** Lỗi ném ra giữa chừng stream (SDK catch) - agent.ts emit + đánh hadError */
  threw: string | null;
}

/** Tiêu thụ message stream của `query()` tới hết lượt - nguyên vẹn từ agent.ts bản gốc */
export async function consumeClaudeTurn(
  sessionId: string,
  projectId: string | null,
  q: Query,
  hooks: ClaudeTurnHooks,
): Promise<ClaudeTurnOutcome> {
  let textBuffer = "";
  let resultSaved = false;
  let hadError = false;
  let finalText: string | null = null;

  try {
    for await (const raw of q) {
      const msg = raw as unknown as AgentMessage;

      if (msg.type === "system" && msg.subtype === "init") {
        // Lưu sdkSessionId để lần sau resume đúng phiên Claude Code
        if (typeof msg.session_id === "string" && msg.session_id) {
          db.setSdkSessionId(sessionId, msg.session_id);
        }
        continue;
      }

      if (msg.type === "stream_event") {
        const ev = msg.event;
        if (
          ev?.type === "content_block_delta" &&
          ev.delta?.type === "text_delta" &&
          typeof ev.delta.text === "string"
        ) {
          textBuffer += ev.delta.text;
          hooks.onText(ev.delta.text);
        }
        continue;
      }

      if (msg.type === "assistant") {
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block?.type === "tool_use") {
              const tool = { name: String(block.name ?? "unknown"), input: block.input ?? {} };
              hooks.onTool(tool);
              db.addChatMessage(sessionId, "assistant", "tool", JSON.stringify(tool));
            }
          }
        }
        continue;
      }

      if (msg.type === "result") {
        // Ghi nhận token đã dùng cho lượt chạy này (gắn theo project của session)
        try {
          const inTok =
            (msg.usage?.input_tokens ?? msg.input_tokens ?? 0) +
            (msg.usage?.cache_creation_input_tokens ?? 0) +
            (msg.usage?.cache_read_input_tokens ?? 0);
          const outTok = msg.usage?.output_tokens ?? msg.output_tokens ?? 0;
          const cost = typeof msg.total_cost_usd === "number" ? msg.total_cost_usd : 0;
          if (inTok > 0 || outTok > 0 || cost > 0) {
            db.addTokenUsage(sessionId, projectId, inTok, outTok, cost);
          }
        } catch {
          /* usage là phụ - không để hỏng luồng chính */
        }
        finalText = typeof msg.result === "string" && msg.result.length > 0 ? msg.result : textBuffer;
        if (msg.subtype && msg.subtype !== "success") {
          hadError = true;
          hooks.onError(`Agent kết thúc bất thường (${msg.subtype})`);
        }
        if (finalText) {
          db.addChatMessage(sessionId, "assistant", "text", finalText);
          resultSaved = true;
        }
      }
    }
    return { text: finalText ?? textBuffer, saved: resultSaved, hadError, threw: null };
  } catch (err) {
    // Lỗi giữa chừng: giữ lại phần text đã stream để không mất lịch sử (saved=false
    // → agent.ts lưu), báo lỗi lên trên để emit + đánh hadError
    return {
      text: textBuffer,
      saved: false,
      hadError: true,
      threw: err instanceof Error ? err.message : String(err),
    };
  }
}
