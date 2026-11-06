import { exec } from "node:child_process";
import { hasClaudeAuth } from "./config.js";
import * as db from "./db.js";
import { readRenderSettings } from "./renderSettings.js";

/**
 * Engine điều khiển agent của một phiên chat.
 *
 * - "claude": Claude Agent SDK (kiến trúc gốc — có session memory, usage/cost).
 * - CLI engines: agent CLI người dùng đã login trên máy (subscription) — chạy
 *   headless, tự sửa file + gọi REST loopback như agent Claude (AIEVv2 điều
 *   khiển agent bằng filesystem + REST nên bất kỳ CLI agent nào cũng chạy được,
 *   xem docs/AGENT-ENGINES.md). Stateless: context đưa qua prompt mỗi lượt.
 */

export const CLI_ENGINES = ["codex", "gemini", "opencode", "custom"] as const;
export type CliEngine = (typeof CLI_ENGINES)[number];
export type AgentEngine = "claude" | CliEngine;

export const KNOWN_ENGINES: readonly AgentEngine[] = ["claude", ...CLI_ENGINES];

export const ENGINE_LABELS: Record<AgentEngine, string> = {
  claude: "Claude Code",
  codex: "Codex CLI (ChatGPT)",
  gemini: "Gemini CLI",
  opencode: "OpenCode",
  custom: "CLI tùy chỉnh",
};

/** Lệnh cài gợi ý cho UI (tab Kết nối → Agent điều khiển) */
export const ENGINE_INSTALL_HINTS: Record<CliEngine, string> = {
  codex: "npm i -g @openai/codex rồi chạy `codex` để login ChatGPT",
  gemini: "npm i -g @google/gemini-cli rồi chạy `gemini` để login Google",
  opencode: "npm i -g opencode-ai",
  custom: "Điền lệnh CLI tùy chỉnh (chứa {prompt_file}) ở tab Kết nối",
};

export function isKnownEngine(v: string): v is AgentEngine {
  return (KNOWN_ENGINES as readonly string[]).includes(v);
}

export function isCliEngine(v: string): v is CliEngine {
  return (CLI_ENGINES as readonly string[]).includes(v);
}

/** Engine của phiên — null/cột cũ/giá trị lạ đều về "claude" (tương thích ngược) */
export function engineOfSession(session: Pick<db.ChatSessionRow, "engine"> | null | undefined): AgentEngine {
  const e = session?.engine;
  return e && isKnownEngine(e) ? e : "claude";
}

// ------------------------------------------------------------- detection ---

export interface EngineStatus {
  id: AgentEngine;
  label: string;
  installed: boolean;
  hint: string | null;
}

interface DetectCache {
  at: number;
  statuses: EngineStatus[];
}

let cache: DetectCache | null = null;
const CACHE_MS = 60_000;

/** Chạy lệnh version ngắn (exec tự đi qua shell — npm shim .cmd chạy được trên Windows) */
function probeCli(command: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const child = exec(command, { timeout: timeoutMs, windowsHide: true }, (err) => resolve(!err));
    child.on("error", () => resolve(false));
  });
}

export async function engineStatuses(force = false): Promise<EngineStatus[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.statuses;
  const [codex, gemini, opencode] = await Promise.all([
    probeCli("codex --version"),
    probeCli("gemini --version"),
    probeCli("opencode --version"),
  ]);
  const customConfigured = Boolean(readRenderSettings().aiCustomCliCommand?.trim());
  const statuses: EngineStatus[] = [
    { id: "claude", label: ENGINE_LABELS.claude, installed: hasClaudeAuth(), hint: null },
    { id: "codex", label: ENGINE_LABELS.codex, installed: codex, hint: codex ? null : ENGINE_INSTALL_HINTS.codex },
    { id: "gemini", label: ENGINE_LABELS.gemini, installed: gemini, hint: gemini ? null : ENGINE_INSTALL_HINTS.gemini },
    { id: "opencode", label: ENGINE_LABELS.opencode, installed: opencode, hint: opencode ? null : ENGINE_INSTALL_HINTS.opencode },
    {
      id: "custom",
      label: ENGINE_LABELS.custom,
      installed: customConfigured,
      hint: customConfigured ? null : ENGINE_INSTALL_HINTS.custom,
    },
  ];
  cache = { at: Date.now(), statuses };
  return statuses;
}

/** Đảm bảo đã detect ít nhất một lần — runAgent gọi trước khi check engine CLI */
export async function ensureEnginesDetected(): Promise<void> {
  try {
    await engineStatuses(false);
  } catch {
    /* detection là tối ưu hóa thông báo lỗi - fail thì cứ để engine chạy thử */
  }
}

/**
 * Engine sẵn sàng để chạy không (đồng bộ, dựa cache từ ensureEnginesDetected).
 * Chưa detect lần nào → lạc quan trả true: lỗi thật sẽ surfaced qua stream
 * khi CLI spawn fail, tốt hơn là chặn nhầm.
 */
export function engineReady(id: AgentEngine): boolean {
  if (id === "claude") return hasClaudeAuth();
  const s = cache?.statuses.find((x) => x.id === id);
  return s ? s.installed : true;
}
