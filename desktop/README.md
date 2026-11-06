# AIEV Desktop (vỏ Tauri)

Vỏ desktop mỏng gói nguyên hệ thống AIEVv2: shell **spawn stack thật** (Express :6869 + Next.js :6868), đợi healthy rồi điều hướng webview tới `http://localhost:6868`. UI/backend/engines **không đổi gì** — mọi tính năng của dashboard web chạy y nguyên trong cửa sổ app.

## Vai trò của shell (và chỉ vậy)

1. Tìm repo (`AIEV_ROOT` → đi lên từ exe → `../../` cho dev)
2. Bootstrap lần đầu: `node start\doctor.mjs --fix --yes` → `npm install` nếu thiếu → build nếu stale (build-stamp) → tạo `.env`
3. Quản lý port 6868/6869 y như `start/start.ps1` (probe `127.0.0.1`, so stamp `.aiev/run.json`, kill listener sai bản)
4. Spawn 2 process con: `node apps/server/dist/index.js` + `next start -p 6868 -H 0.0.0.0`
5. Drain stdout/stderr → `.aiev/logs/{server,web}.log`, health-gate `/api/health` rồi mới mở webview
6. Watchdog: process con chết → tự restart 1 lần (nếu update từ web UI đã dựng lại stack thì chỉ nhận lại); chết lần nữa → trang lỗi
7. Đóng cửa sổ = ẩn vào tray (render chạy tiếp); **Thoát** trên tray = tắt hẳn (tree-kill cả ffmpeg/Remotion/Chrome)

## Build

```powershell
# Cần Rust (rustup + MSVC Build Tools)
npm install                 # root — cài @tauri-apps/cli (desktop là workspace)
npm run desktop:build       # → desktop/src-tauri/target/release/bundle/nsis/
npm run desktop:dev         # chạy bản dev
```

Exe tìm repo theo: biến môi trường `AIEV_ROOT` → đi lên từ vị trí exe (đặt exe trong repo hoặc cạnh repo) → fallback dev. Dữ liệu vẫn nằm trong repo như mode browser (`video-projects/`, `apps/server/data/`, `.runtime/`…).

## Giới hạn v1

- Windows-first (macOS: driver đã cross-platform, shell cần port sau — `start.sh` là tham khảo)
- Ghi âm micro trên webview (WebView2) chưa cấp quyền — dùng nút ghi âm qua browser `start.bat` khi cần
- Custom agent CLI chạy qua shell — chỉ điền lệnh của chính bạn
