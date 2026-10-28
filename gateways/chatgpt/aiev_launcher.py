# -*- coding: utf-8 -*-
# AIEV launcher for the vendored chatgpt2api gateway.
# Copyright (C) 2026 noti.vn and AIEV contributors
#
# This file lives inside gateways/chatgpt/ and is distributed under the same
# GNU Affero General Public License v3.0 (only) as the vendored code - see
# ./LICENSE and ./NOTICE. It is NOT part of upstream chatgpt2api; it only starts
# upstream's `main:app` unchanged (see UPSTREAM.md).
"""
Chay chatgpt2api (main:app) bang uvicorn cho AIEV, KHONG can Docker/Postgres.

Node (apps/server/src/imageProviders/chatgptGateway.ts) spawn file nay voi:
  python aiev_launcher.py <port>
va dat san env:
  CHATGPT2API_AUTH_KEY     - khoa admin/Bearer (= CHATGPT_GATEWAY_KEY trong .env cua AIEV)
  CHATGPT2API_DATA_DIR     - .runtime/chatgpt-gateway/data   (patch duy nhat cua ta, xem UPSTREAM.md)
  CHATGPT2API_CONFIG_FILE  - .runtime/chatgpt-gateway/config.json
  DATABASE_URL             - sqlite:///.runtime/chatgpt-gateway/data/chatgpt2api.db

VI SAO CO FILE NAY thay vi goi thang `uvicorn main:app`: can mot co che de
gateway TU THOAT khi server AIEV chet (ke ca bi kill cung, khong kip don dep).
stdin la ong noi voi Node - Node chet thi ong dong, readline tra chuoi rong,
va ta thoat ngay. Khong co no thi tien trinh mo coi giu cong 6871 mai mai.

Chu thich KHONG DAU co y (console Windows cp1252, xem vieneu_worker.py).
"""

import os
import sys
import threading

HERE = os.path.dirname(os.path.abspath(__file__))


def _watch_parent():
    try:
        while True:
            if not sys.stdin.readline():
                break
    except Exception:
        pass
    # os._exit chu khong phai sys.exit: thread phu khong dung duoc vong lap
    # uvicorn, va khong can lifespan don dep gi - du lieu nam trong SQLite.
    os._exit(0)


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except Exception:
            pass
    if HERE not in sys.path:
        sys.path.insert(0, HERE)
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 6871
    threading.Thread(target=_watch_parent, name="aiev-parent-watch", daemon=True).start()

    import uvicorn

    # 127.0.0.1 BAT BUOC: gateway giu token tai khoan ChatGPT - khong bao gio mo ra LAN.
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=port,
        log_level=os.getenv("CHATGPT_GATEWAY_LOG_LEVEL", "warning"),
        access_log=False,
    )


if __name__ == "__main__":
    main()
