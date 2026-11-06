// Test extractCliEvent — parse output JSONL của các agent CLI (codex/claude stream).
// Chạy qua bản build: npm test -w apps/server (tsc trước rồi node --test).
// Dùng node:test có sẵn — không thêm vitest chỉ cho test pure-function.
import test from "node:test";
import assert from "node:assert/strict";
import { extractCliEvent } from "../dist/agentDrivers/cliDriver.js";

test("dòng rỗng / whitespace → không event", () => {
  assert.deepEqual(extractCliEvent(""), {});
  assert.deepEqual(extractCliEvent("   \t"), {});
});

test("text thường (gemini/opencode stdout) → delta", () => {
  assert.deepEqual(extractCliEvent("Xin chào"), { delta: "Xin chào\n" });
  assert.deepEqual(extractCliEvent("dòng hai"), { delta: "dòng hai\n" });
});

test("codex exec --json (0.166+): agent_message → delta", () => {
  const line = JSON.stringify({
    type: "item.completed",
    item: { type: "agent_message", text: "Đã đọc package.json" },
  });
  assert.deepEqual(extractCliEvent(line), { delta: "Đã đọc package.json\n" });
});

test("codex: item_type cho bản cũ", () => {
  const line = JSON.stringify({
    type: "item.completed",
    item: { item_type: "agent_message", text: "xong" },
  });
  assert.deepEqual(extractCliEvent(line), { delta: "xong\n" });
});

test("codex: command_execution → tool (cắt 120 ký tự)", () => {
  const long = "powershell -Command Get-Content package.json -Raw".padEnd(200, "x");
  const line = JSON.stringify({
    type: "item.completed",
    item: { type: "command_execution", command: long },
  });
  const ev = extractCliEvent(line);
  assert.ok(ev.tool && ev.tool.length <= 120);
});

test("codex: error item → error", () => {
  const line = JSON.stringify({
    type: "item.completed",
    item: { type: "error", message: "sandbox blocked write" },
  });
  assert.deepEqual(extractCliEvent(line), { error: "sandbox blocked write" });
});

test("codex: item.started / turn.completed / thread.started → noise", () => {
  assert.deepEqual(extractCliEvent(JSON.stringify({ type: "item.started", item: {} })), {});
  assert.deepEqual(extractCliEvent(JSON.stringify({ type: "turn.completed" })), {});
  assert.deepEqual(extractCliEvent(JSON.stringify({ type: "thread.started" })), {});
});

test("claude stream-json: assistant content → delta hoặc tool", () => {
  const textLine = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "text", text: "a" }, { type: "text", text: "b" }] },
  });
  assert.deepEqual(extractCliEvent(textLine), { delta: "a\nb\n" });
  const toolLine = JSON.stringify({
    type: "assistant",
    message: { content: [{ type: "tool_use", name: "Read" }] },
  });
  assert.deepEqual(extractCliEvent(toolLine), { tool: "Read" });
});

test("claude stream-json: result → delta; is_error → error", () => {
  assert.deepEqual(extractCliEvent(JSON.stringify({ type: "result", result: "kết quả" })), {
    delta: "kết quả\n",
  });
  assert.deepEqual(extractCliEvent(JSON.stringify({ type: "error", error: "hỏng" })), {
    error: "hỏng",
  });
  assert.deepEqual(extractCliEvent(JSON.stringify({ is_error: true, result: "lỗi nữa" })), {
    error: "lỗi nữa",
  });
});

test("JSON lạ không phá stream (tiêu thụ im)", () => {
  assert.deepEqual(extractCliEvent(JSON.stringify({ foo: "bar", nested: { a: 1 } })), {});
});

test("JSON parse lỗi → coi như text thường", () => {
  assert.deepEqual(extractCliEvent("{not json"), { delta: "{not json\n" });
});
