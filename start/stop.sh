#!/usr/bin/env bash
# AI Edit Video by noti.vn - dừng hệ thống (macOS / Linux)
set -u

echo "  Đang dừng AI Edit Video..."
STOPPED=false
for port in 6868 6869; do
  # -sTCP:LISTEN: chỉ tiến trình đang nghe cổng, không phải trình duyệt đang nối tới nó
  PIDS="$(lsof -ti tcp:$port -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
    echo "  [OK] Đã dừng process trên port $port"
    STOPPED=true
  fi
done
# Xóa dấu vết "đang chạy" - để lại thì lần chạy start sau tưởng hệ thống vẫn sống.
rm -f "$(cd "$(dirname "$0")/.." && pwd)/.aiev/run.json"

$STOPPED || echo "  Không có gì đang chạy trên port 6868/6869."
