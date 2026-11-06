# Agent Engines — nhiều subscription AI điều khiển hệ thống

> Từ v2.1. Phiên chat/edit không còn khóa một provider: ngoài Claude Code (Agent SDK,
> kiến trúc gốc), agent CLI subscription nào login trên máy cũng điều khiển được.

## Vì sao làm được

AIEVv2 điều khiển agent bằng **filesystem + REST loopback**, không phải function-calling:

- Agent chạy trong repo root, tự `Read`/`Edit`/`Bash` (meta.json, compositions/, renders/…)
- Render/QC/publish… agent tự gọi qua `curl http://localhost:6869/api/...` — request từ
  loopback không có `Origin` được auth của server coi là local (util.ts `isLocalRequest`)
- CLAUDE.md là bộ chỉ dẫn hệ thống, được driver prepend vào prompt cho MỌI engine

→ Bất kỳ CLI agent nào biết đọc/sửa file + chạy shell đều điều khiển được trọn pipeline.

## Engine

| Engine | Chạy bằng | Cài / đăng nhập | Ghi chú |
|---|---|---|---|
| `claude` (mặc định) | Agent SDK 0.3.x | `claude` → `/login` (subscription) hoặc `ANTHROPIC_API_KEY` | Có memory phiên (resume), hiện usage/cost, effort |
| `codex` | Codex CLI | `npm i -g @openai/codex` + `codex` login | ChatGPT Plus/Pro. Windows: `--dangerously-bypass-approvals-and-sandbox` (codex Windows chưa có sandbox — mức quyền tương đương agent Claude vốn acceptEdits + Bash tự do) |
| `gemini` | Gemini CLI | `npm i -g @google/gemini-cli` + login | `-y` auto-approve write |
| `opencode` | OpenCode | `npm i -g opencode-ai` | |
| `custom` | Lệnh bất kỳ | Điền ở tab **Kết nối → Agent điều khiển** | Template bắt buộc chứa `{prompt_file}` (vd `agy run --prompt-file {prompt_file}`) — prompt ghi ra `.aiev/prompt-<sessionId>.txt` |

Trạng thái cài đặt: `GET /api/providers` → `engines[]` (probe `--version` + Claude auth, cache 60s).

## Chọn engine

- Khung chat / editor chat / modal "Bắt đầu edit": select **Agent điều khiển** đứng trước ô model
- Trang **Kết nối → Agent điều khiển**: trạng thái + hướng dẫn cài + cấu hình lệnh custom
- `POST /api/chat` (và `/editor/chat`, `/editor/handoff`, `/projects/:id/edit`): body thêm
  `engine` + `model` free-form (CLI engine bỏ qua `effort`). Engine lưu vào cột
  `chat_sessions.engine` — đổi được giữa chừng, lượt sau dùng lựa chọn mới.

## Kiến trúc

```
runAgent()  (agent.ts — orchestration engine-agnostic)
  ├─ engine "claude" → agentDrivers/claudeDriver.ts   (Agent SDK query + stream)
  └─ engine CLI      → agentDrivers/cliDriver.ts      (spawn CLI headless trong repo root)
```

- **Cùng shape SSE** `{sessionId, kind: text|tool|result|error|done}` — UI không phân biệt engine
- **CLI stateless**: mỗi lượt là một spawn mới; prompt = `<project-instructions>CLAUDE.md</project-instructions>`
  + `<conversation-so-far>` (12 lượt gần nhất) + message
- **Interrupt**: claude = `Query.interrupt()`; CLI = `taskkill /T /F` cây process
- **Env CLI**: `agentEnv()` gỡ mọi khóa bí mật; với CLI gỡ nốt biến Claude — CLI đọc
  credential từ config riêng của nó (~/.codex, ~/.gemini…)
- **Gate + auto-resume** (goal final/draft) chạy chung cho mọi engine — đã engine-agnostic sẵn

## Giới hạn v1 (CLI engines)

- Không resume phiên phía CLI — ngữ cảnh qua prompt (12 lượt); lượt dài có thể "quên" đầu phiên
- `effort` bỏ qua; usage/cost = 0 (CLI không báo token) — Dashboard không cộng tiền cho CLI
- Model free-form chỉ truyền cho engine nhận (`codex -m`, `gemini -m`, `opencode --model`)
- Shell Windows-first (macOS: đổi cờ sandbox của codex, phần còn lại cross-platform sẵn)
- Lệnh custom chạy qua shell — chỉ điền lệnh của chính bạn
