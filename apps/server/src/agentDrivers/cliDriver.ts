import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { agentEnv } from "../agentPolicy.js";
import { repoRoot } from "../config.js";
import * as db from "../db.js";
import { isCliEngine, type CliEngine } from "../agentEngines.js";
import { readRenderSettings } from "../renderSettings.js";

/**
 * CLI Agent Driver — chạy agent CLI subscription (codex/gemini/opencode/custom)
 * headless trong repo root. Port từ aiev-desktop/apps/media-core/src/cliagent.ts
 * (đã chạy thật trên Windows: codex 0.166, opencode, agy).
 *
 * Khác với Claude SDK: CLI không có session memory → mỗi lượt là một spawn mới,
 * context (CLAUDE.md + transcript rút gọn) đưa qua prompt. Agent vẫn điều khiển
 * AIEVv2 đúng kiến trúc gốc: tự Read/Edit file + gọi REST loopback 6869 qua Bash.
 *
 * Prompt LUÔN đi qua stdin (dấu "-" của codex / mặc định của claude-cli) — tránh
 * escape shell hoàn toàn; Windows npm shim là .cmd nên cần shell:true.
 */

/** CLI process đang chạy theo sessionId — interrupt = kill tree */
const runningChildren = new Map<string, ChildProcess>();

export function interruptCli(sessionId: string): boolean {
  const child = runningChildren.get(sessionId);
  if (!child) return false;
  killTree(child.pid);
  return true;
}

function killTree(pid: number | undefined): void {
  if (!pid) return;
  if (process.platform === "win32") {
    // CLI tự spawn con (node/python...) — taskkill /T diệt cả cây
    spawn("taskkill", ["/F", "/T", "/PID", String(pid)], { windowsHide: true, stdio: "ignore" });
  } else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* đã chết */
    }
  }
}

/** Lệnh per engine. Model chỉ truyền cho engine nhận -m/--model; custom bỏ qua. */
function buildCommand(
  engine: CliEngine,
  model: string | null,
  customCommand: string,
  promptFileAbs: string,
): { cmd: string; args: string[]; shell: boolean } {
  const win = process.platform === "win32";
  switch (engine) {
    case "codex": {
      // Windows: codex chưa hiện thực sandbox → workspace-write vẫn chặn write
      // (đo thật ở aiev-desktop) → cần bypass. Agent AIEVv2 vốn chạy acceptEdits +
      // Bash tự do (chỉ agentPolicy chặn mạng) nên mức quyền tương đương.
      const sandbox = win
        ? ["--dangerously-bypass-approvals-and-sandbox"]
        : ["--sandbox", "workspace-write"];
      const modelArgs = model ? ["-m", model] : [];
      return {
        cmd: "codex",
        args: ["exec", "--json", "--skip-git-repo-check", ...modelArgs, ...sandbox, "-"],
        shell: win,
      };
    }
    case "gemini": {
      const modelArgs = model ? ["-m", model] : [];
      // -y (yolo): auto-approve write — không có nó thì gemini -p từ chối sửa file
      return { cmd: "gemini", args: [...modelArgs, "-p", "-y"], shell: win };
    }
    case "opencode":
      return { cmd: "opencode", args: model ? ["run", "--model", model] : ["run"], shell: win };
    case "custom": {
      // Template chứa {prompt_file} — prompt ghi ra file, CLI đọc từ file
      // (vd: agy run --prompt-file {prompt_file})
      if (!customCommand.trim()) {
        throw new Error("CUSTOM_CLI_EMPTY: chưa cấu hình lệnh CLI tùy chỉnh (tab Kết nối)");
      }
      if (!customCommand.includes("{prompt_file}")) {
        throw new Error(
          'CUSTOM_CLI_TEMPLATE: lệnh tùy chỉnh phải chứa "{prompt_file}" (vd: agy run --prompt-file {prompt_file})',
        );
      }
      return {
        cmd: customCommand.replaceAll("{prompt_file}", `"${promptFileAbs}"`),
        args: [],
        shell: true,
      };
    }
  }
}

/** Trích text/tool/error từ 1 dòng output CLI (JSONL của codex, text thường của gemini/opencode) */
export function extractCliEvent(line: string): { delta?: string; tool?: string; error?: string } {
  if (!line.trim()) return {};
  if (!line.startsWith("{")) return { delta: line + "\n" };
  try {
    const j = JSON.parse(line) as Record<string, unknown>;
    // codex exec --json (0.166+): {"type":"item.completed","item":{...}};
    // chấp nhận cả item_type cho bản cũ
    const item = j["item"] as Record<string, unknown> | undefined;
    if (item) {
      const itemType = String(item["type"] ?? item["item_type"] ?? "");
      if (itemType === "agent_message" && typeof item["text"] === "string") return { delta: item["text"] + "\n" };
      if (itemType === "command_execution" || itemType === "command_output" || itemType === "file_change") {
        return { tool: String(item["command"] ?? item["cmd"] ?? itemType).slice(0, 120) };
      }
      if (itemType === "error") return { error: String(item["message"] ?? "CLI error") };
    }
    if (j["type"] === "item.started") return {}; // noise
    if (j["type"] === "turn.completed" || j["type"] === "thread.started") return {};
    // claude stream-json (nếu ai trỏ custom vào claude CLI): assistant content[] / result
    if (j["type"] === "assistant") {
      const message = j["message"] as { content?: Array<{ type?: string; text?: string; name?: string }> } | undefined;
      const out: string[] = [];
      let toolName: string | undefined;
      for (const part of message?.content ?? []) {
        if (part.type === "text" && part.text) out.push(part.text);
        if (part.type === "tool_use" && part.name) toolName = part.name;
      }
      if (out.length) return { delta: out.join("\n") + "\n" };
      if (toolName) return { tool: toolName };
      return {};
    }
    if (j["type"] === "result" && typeof j["result"] === "string") return { delta: j["result"] + "\n" };
    if (j["type"] === "error" || j["is_error"] === true)
      return { error: String(j["error"] ?? j["result"] ?? "CLI error").slice(0, 300) };
    return {}; // JSON lạ: tiêu thụ im để không phá stream
  } catch {
    return { delta: line + "\n" };
  }
}

/**
 * Prompt cho CLI engine (stateless): project instructions (CLAUDE.md) + transcript
 * rút gọn các lượt trước + message mới. Message hiện tại KHÔNG lặp trong transcript
 * (runAgent đã addChatMessage trước khi build prompt).
 */
export function buildCliPrompt(session: db.ChatSessionRow | null | undefined, message: string): string {
  let instructions = "";
  try {
    instructions = fs.readFileSync(path.join(repoRoot, "CLAUDE.md"), "utf8");
  } catch {
    /* không có CLAUDE.md thì thôi */
  }
  let transcript = "";
  if (session) {
    try {
      const history = db
        .listChatMessages(session.sessionId)
        .filter((m) => m.kind === "text")
        .slice(0, -1) // bỏ message vừa thêm (chính là message này)
        .slice(-12);
      if (history.length) {
        transcript = history
          .map((m) => `${m.role === "user" ? "Người dùng" : "Trợ lý"}: ${m.content}`)
          .join("\n\n");
      }
    } catch {
      /* mất transcript chỉ kém ngữ cảnh - không hỏng lượt chạy */
    }
  }
  const parts: string[] = [];
  if (instructions) parts.push(`<project-instructions source="CLAUDE.md">\n${instructions}\n</project-instructions>`);
  if (transcript) parts.push(`<conversation-so-far>\n${transcript}\n</conversation-so-far>`);
  parts.push(message);
  return parts.join("\n\n");
}

export interface CliTurnHooks {
  onText(text: string): void;
  onTool(tool: { name: string; input: unknown }): void;
  onError(error: string): void;
  /** true = user đã bấm interrupt (interruptAgent thêm vào set trước khi kill) */
  isInterrupted(): boolean;
}

export interface CliTurnResult {
  ok: boolean;
  text: string;
  /** "INTERRUPTED" = user chủ động dừng — agent.ts không emit error cho case này */
  error?: string;
}

export async function runCliTurn(opts: {
  sessionId: string;
  engine: CliEngine;
  model: string | null;
  prompt: string;
  hooks: CliTurnHooks;
}): Promise<CliTurnResult> {
  const { sessionId, engine, model, prompt, hooks } = opts;

  let cmd: string;
  let args: string[];
  let shell: boolean;
  let promptFile: string | null = null;
  try {
    const custom = engine === "custom" ? (readRenderSettings().aiCustomCliCommand ?? "") : "";
    if (engine === "custom") {
      promptFile = path.join(repoRoot, ".aiev", `prompt-${sessionId}.txt`);
      fs.mkdirSync(path.dirname(promptFile), { recursive: true });
      fs.writeFileSync(promptFile, prompt, "utf8");
    }
    ({ cmd, args, shell } = buildCommand(engine, model, custom, promptFile ?? ""));
  } catch (err) {
    return { ok: false, text: "", error: err instanceof Error ? err.message : String(err) };
  }

  // Env sạch: agentEnv() gỡ mọi khóa bí mật (Gemini/OpenAI/AIEV_API_TOKEN...) —
  // với engine không phải Claude thì gỡ nốt biến Claude để CLI không nhìn thấy.
  const env = agentEnv();
  delete env["ANTHROPIC_API_KEY"];
  delete env["CLAUDE_CODE_OAUTH_TOKEN"];
  delete env["ANTHROPIC_AUTH_TOKEN"];

  let fullText = "";
  let stderrTail = "";
  let lineBuf = "";

  return await new Promise<CliTurnResult>((resolve) => {
    let child: ChildProcess;
    try {
      child = spawn(cmd, args, {
        cwd: repoRoot,
        env,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
        shell,
      });
    } catch (e) {
      return resolve({ ok: false, text: "", error: spawnHint(e, engine) });
    }

    child.on("error", (e) => {
      runningChildren.delete(sessionId);
      resolve({ ok: false, text: fullText, error: spawnHint(e, engine) });
    });

    child.stdout?.on("data", (chunk: Buffer) => {
      lineBuf += chunk.toString();
      const lines = lineBuf.split(/\r?\n/);
      lineBuf = lines.pop() ?? "";
      for (const line of lines) {
        const ev = extractCliEvent(line);
        if (ev.delta) {
          fullText += ev.delta;
          hooks.onText(ev.delta);
        }
        if (ev.tool) hooks.onTool({ name: ev.tool, input: {} });
        if (ev.error) hooks.onError(ev.error);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-6000);
    });
    child.on("close", (code) => {
      runningChildren.delete(sessionId);
      if (promptFile) {
        try {
          fs.unlinkSync(promptFile);
        } catch {
          /* dọn mà thất bại thì thôi */
        }
      }
      // Dòng cuối còn dư (không có \n kết thúc) — xử nốt
      if (lineBuf.trim()) {
        const ev = extractCliEvent(lineBuf);
        if (ev.delta) {
          fullText += ev.delta;
          hooks.onText(ev.delta);
        }
      }
      if (hooks.isInterrupted()) {
        resolve({ ok: false, text: fullText, error: "INTERRUPTED" });
        return;
      }
      if (code === 0 || fullText.length > 0) resolve({ ok: true, text: fullText });
      else resolve({ ok: false, text: fullText, error: `CLI ${engine} thất bại (exit ${code}): ${stderrTail.slice(-800)}` });
    });

    runningChildren.set(sessionId, child);
    // Prompt qua stdin (custom đọc từ prompt_file)
    if (engine !== "custom") {
      child.stdin?.write(prompt);
    }
    child.stdin?.end();
  });
}

function spawnHint(e: unknown, engine: CliEngine): string {
  const msg = e instanceof Error ? e.message : String(e);
  const hint: Record<CliEngine, string> = {
    codex: "codex: npm i -g @openai/codex rồi chạy `codex` để login",
    gemini: "gemini: npm i -g @google/gemini-cli rồi chạy `gemini` để login",
    opencode: "opencode: npm i -g opencode-ai",
    custom: "kiểm tra lại lệnh tùy chỉnh ở tab Kết nối",
  };
  return `Không chạy được CLI ${engine}: ${msg} — ${hint[engine]}`;
}

/** Re-export để agent.ts một điểm import (tránh import lẫn kiểu) */
export { isCliEngine };
