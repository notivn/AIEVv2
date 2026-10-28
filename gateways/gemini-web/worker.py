# -*- coding: utf-8 -*-
# Gemini web image worker for AI Edit Video (AIEV).
# Copyright (C) 2026 noti.vn and AIEV contributors
#
# This program is free software: you can redistribute it and/or modify it
# under the terms of the GNU Affero General Public License as published by the
# Free Software Foundation, version 3 of the License.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details. You should have received a copy of the license in ./LICENSE; if not,
# see <https://www.gnu.org/licenses/>.
#
# This file links against gemini-webapi (HanaokaYuzu/Gemini-API, AGPL-3.0),
# which is why it - and only this directory - is AGPL. The rest of AIEV talks
# to it as a separate process over stdin/stdout (JSON lines) and stays MIT.
"""
Worker Gemini web - doc lenh JSON tren stdin, tra ket qua JSON tren stdout.

VI SAO SONG LAU: gemini_webapi tu xoay vong cookie __Secure-1PSIDTS bang mot
tac vu nen (auto_refresh). Tien trinh chet sau moi lan goi thi tac vu do khong
bao gio chay, cookie het han sau vai gio va nguoi dung phai dan lai lien tuc.
Node (apps/server/src/imageProviders/geminiWeb.ts) giu dung MOT worker.

GIAO THUC (giong apps/server/python/vieneu_worker.py): moi dong stdout la MOT
doi tuong JSON {id, ok, ...} - log/canh bao di stderr. stdin dong (Node chet,
ke ca bi kill cung) -> worker tu thoat, khong de tien trinh mo coi.

Lenh:
  ping                                   -> {ok, version, ready}
  init     {psid, psidts?}               -> {ok}           (dang nhap + bat auto_refresh)
  generate {prompt, size?, outDir, model?} -> {ok, file, mime}
  close                                  -> {ok}

Ma loi: NO_GEMINI_WEBAPI, BAD_REQUEST, NOT_INITIALIZED, AUTH_FAILED,
RATE_LIMITED, TIMEOUT, NO_IMAGE, FAILED.

Chu thich KHONG DAU co y: console Windows mac dinh cp1252 (xem vieneu_worker.py).
"""

import sys

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")
sys.stdin.reconfigure(encoding="utf-8")

import asyncio
import json
import math
import mimetypes
import os
import shutil
import tempfile
import traceback
import uuid
from pathlib import Path

# Tach kenh giao thuc khoi stdout: thu vien C / loguru in thang vao fd 1 cung
# khong lam hong dong JSON (cung ky thuat voi vieneu_worker.py).
_protocol_fd = os.dup(1)
os.dup2(2, 1)
_protocol = os.fdopen(_protocol_fd, "w", encoding="utf-8", newline="\n")


def log(msg):
    print("[gemini-web] " + str(msg), file=sys.stderr)
    sys.stderr.flush()


def respond(obj):
    _protocol.write(json.dumps(obj, ensure_ascii=False) + "\n")
    _protocol.flush()


# ---------------------------------------------------------------------------
# Prompt tao anh
# ---------------------------------------------------------------------------

# Gemini web KHONG co model tao anh rieng: sinh anh = model text + prompt co
# DONG TU "generate". README cua gemini_webapi canh bao: noi "send an image of"
# thi Gemini di LAY ANH TU WEB (WebImage, anh cua nguoi khac). Bo tien to nay la
# endpoint tao anh im lang tra anh stock.
IMAGE_PROMPT_PREFIX = "Generate an image. "

# Gemini web khong co tham so size/aspect -> goi y bang CAU CHU. Noi bang TI LE
# (model hieu "9:16 tall portrait" tot, gan nhu bo qua "1080x1920").
IMAGE_SIZE_HINT = "Aspect ratio: {ratio} ({orientation}). Approximate size: {size} pixels."

_RATIO_WORDS = {
    (16, 9): "widescreen landscape",
    (9, 16): "tall portrait",
    (4, 5): "portrait",
    (5, 4): "landscape",
    (3, 2): "landscape",
    (2, 3): "portrait",
    (4, 3): "landscape",
    (3, 4): "portrait",
    (1, 1): "square",
}


def size_hint(size):
    parts = str(size or "").strip().lower().replace(" ", "").split("x")
    if len(parts) != 2 or not all(p.isdigit() for p in parts):
        return "Target image size / aspect ratio: %s." % size
    width, height = int(parts[0]), int(parts[1])
    if width <= 0 or height <= 0:
        return "Target image size / aspect ratio: %s." % size
    d = math.gcd(width, height)
    rw, rh = width // d, height // d
    orientation = _RATIO_WORDS.get(
        (rw, rh), "square" if rw == rh else ("landscape" if rw > rh else "portrait")
    )
    return IMAGE_SIZE_HINT.format(ratio="%d:%d" % (rw, rh), orientation=orientation, size="%dx%d" % (width, height))


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

_client = None
_lib = None


def lib():
    """Import lazy: ping van tra loi duoc khi thieu goi (de Node bao dung benh)."""
    global _lib
    if _lib is None:
        import gemini_webapi  # noqa: F401

        _lib = gemini_webapi
    return _lib


def lib_version():
    try:
        import importlib.metadata as meta

        return meta.version("gemini-webapi")
    except Exception:
        return ""


async def close_client():
    global _client
    client = _client
    _client = None
    if client is not None:
        try:
            await client.close()
        except Exception as err:
            log("dong client loi: %s" % err)


async def cmd_ping(_req):
    return {"ok": True, "version": lib_version(), "ready": _client is not None}


async def cmd_init(req):
    global _client
    psid = str(req.get("psid") or "").strip()
    psidts = str(req.get("psidts") or "").strip()
    # KHONG BAO GIO init voi PSID rong: gemini_webapi khi thieu __Secure-1PSID se
    # quet thu muc cache cookie va lay file MOI SUA GAN NHAT (get_access_token.py)
    # - tuc la dang nhap im lang bang tai khoan Google cua nguoi khac.
    if not psid:
        return {"ok": False, "code": "BAD_REQUEST", "message": "missing __Secure-1PSID"}
    await close_client()
    gw = lib()
    client = gw.GeminiClient(psid, psidts or None, proxy=(os.getenv("GEMINI_PROXY") or None))
    kwargs = {
        "timeout": float(os.getenv("GEMINI_REQUEST_TIMEOUT", "300")),
        "auto_close": False,
        "auto_refresh": True,
    }
    try:
        await client.init(watchdog_timeout=float(os.getenv("GEMINI_WATCHDOG_TIMEOUT", "120")), **kwargs)
    except TypeError:
        # Ban gemini_webapi cu khong co watchdog_timeout
        await client.init(**kwargs)
    # DA DO (cookie gia): init() van "thanh cong" o che do khach, chi ghi
    # account_status = UNAUTHENTICATED roi tra loi "can't create images" luc
    # generate. Phai tu soi trang thai ngay o day thi Node moi bao dung
    # "cookie het han" thay vi mot loi tao anh kho hieu.
    bad = account_problem(client)
    if bad is not None:
        try:
            await client.close()
        except Exception:
            pass
        return bad
    _client = client
    return {"ok": True}


def account_problem(client):
    """None neu tai khoan dung duoc; nguoc lai ket qua loi co ma."""
    status = getattr(client, "account_status", None)
    name = str(getattr(status, "name", "") or "")
    if not name or name == "AVAILABLE":
        return None
    desc = str(getattr(status, "description", "") or "")
    code = "RATE_LIMITED" if "TEMPORARILY" in name else "AUTH_FAILED"
    return {"ok": False, "code": code, "message": ("%s - %s" % (name, desc))[:400]}


async def _generate_once(prompt, model):
    kwargs = {}
    if model:
        kwargs["model"] = model
    try:
        # Moi luot la hoi thoai dung mot lan - khong rac lich su tai khoan.
        return await _client.generate_content(prompt, temporary=True, **kwargs)
    except TypeError:
        return await _client.generate_content(prompt, **kwargs)


async def cmd_generate(req):
    if _client is None:
        return {"ok": False, "code": "NOT_INITIALIZED", "message": "client not initialized"}
    # auto_refresh co the da phat hien cookie chet giua hai lan goi
    bad = account_problem(_client)
    if bad is not None:
        return bad
    prompt =str(req.get("prompt") or "").strip()
    out_dir = str(req.get("outDir") or "").strip()
    if not prompt or not out_dir:
        return {"ok": False, "code": "BAD_REQUEST", "message": "missing prompt/outDir"}
    full = IMAGE_PROMPT_PREFIX + prompt
    size = str(req.get("size") or "").strip()
    if size and size.lower() != "auto":
        full = "%s\n\n%s" % (full, size_hint(size))
    model = str(req.get("model") or "").strip() or None

    response = await _generate_once(full, model)
    # CHI lay generated_images. `.images` tron ca WebImage (anh lay tu web, ban
    # quyen cua nguoi khac) - giao anh web cho endpoint tao anh la giao nham hang.
    candidates = list(getattr(response, "candidates", None) or [])
    if not candidates:
        return {"ok": False, "code": "NO_IMAGE", "message": "empty response"}
    chosen = getattr(response, "chosen", 0) or 0
    if chosen >= len(candidates):
        chosen = 0
    images = list(getattr(candidates[chosen], "generated_images", None) or [])
    if not images:
        text = str(getattr(candidates[chosen], "text", "") or "")[:300]
        return {"ok": False, "code": "NO_IMAGE", "message": text or "no generated image"}

    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=out_dir) as tmp:
        # filename KHONG duoi: thu vien tu doan duoi theo content-type. Khong
        # truyen full_size -> mac dinh True, lay anh goc chu khong phai preview.
        saved = Path(str(await images[0].save(path=tmp, filename="gen-0")))
        mime = mimetypes.guess_type(saved.name)[0] or "image/png"
        target = Path(out_dir) / ("gemini-web-%s%s" % (uuid.uuid4().hex[:12], saved.suffix or ".png"))
        shutil.move(str(saved), str(target))
    return {"ok": True, "file": str(target), "mime": mime}


async def cmd_close(_req):
    await close_client()
    return {"ok": True}


HANDLERS = {
    "ping": cmd_ping,
    "init": cmd_init,
    "generate": cmd_generate,
    "close": cmd_close,
}


def error_result(err):
    """Doi exception cua gemini_webapi thanh ma ngan cho Node."""
    name = type(err).__name__
    text = "%s: %s" % (name, err)
    if isinstance(err, ModuleNotFoundError):
        return {"ok": False, "code": "NO_GEMINI_WEBAPI", "message": text[:400]}
    gw = _lib
    low = text.lower()
    if gw is not None:
        if isinstance(err, getattr(gw, "AuthError", ())):
            return {"ok": False, "code": "AUTH_FAILED", "message": text[:400]}
        limited = tuple(
            c for c in (getattr(gw, "UsageLimitExceededError", None), getattr(gw, "TemporarilyBlockedError", None)) if c
        )
        if limited and isinstance(err, limited):
            return {"ok": False, "code": "RATE_LIMITED", "message": text[:400]}
        gw_timeout = getattr(gw, "TimeoutError", None)
        if gw_timeout and isinstance(err, gw_timeout):
            return {"ok": False, "code": "TIMEOUT", "message": text[:400]}
    if isinstance(err, (TimeoutError, asyncio.TimeoutError)):
        return {"ok": False, "code": "TIMEOUT", "message": text[:400]}
    if "unauthenticated" in low or "cookies have expired" in low or "secure_1psid" in low:
        return {"ok": False, "code": "AUTH_FAILED", "message": text[:400]}
    return {"ok": False, "code": "FAILED", "message": text[:400]}


async def main():
    loop = asyncio.get_running_loop()
    log("worker san sang (gemini-webapi %s)" % (lib_version() or "?"))
    while True:
        # Doc stdin trong thread de vong lap asyncio van chay tac vu auto_refresh
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception as err:
            respond({"id": 0, "ok": False, "code": "BAD_JSON", "message": str(err)[:200]})
            continue
        req_id = req.get("id") if isinstance(req, dict) else 0
        cmd = str(req.get("cmd") or "") if isinstance(req, dict) else ""
        handler = HANDLERS.get(cmd)
        if handler is None:
            respond({"id": req_id, "ok": False, "code": "BAD_REQUEST", "message": "unknown cmd: %s" % cmd})
            continue
        try:
            result = await handler(req)
        except Exception as err:
            log("loi khi chay '%s':\n%s" % (cmd, traceback.format_exc()))
            result = error_result(err)
        result["id"] = req_id
        respond(result)
    log("stdin dong - worker thoat")
    await close_client()


if __name__ == "__main__":
    asyncio.run(main())
