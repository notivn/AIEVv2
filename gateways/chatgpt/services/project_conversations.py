"""One ChatGPT conversation per caller-defined key (AIEV: one per video/image project).

AIEV sends ``conversation_key`` with /v1/images/generations. Without it every image
opened a brand-new ChatGPT conversation, flooding the account's chat history with
one session per image. With it, images of the same project continue the same
conversation.

- A conversation belongs to one ChatGPT account, so the mapping is
  ``key -> {account_email -> conversation_id}``. The account pool still picks the
  account; if it picks another account, that account gets its own conversation
  for the key (bounded by the number of accounts).
- One conversation cannot run two image generations at once, so requests with
  the same key are serialized with a per-key lock. A request that cannot get the
  lock in time falls back to a fresh, unrecorded conversation instead of failing.
- Stored as JSON under DATA_DIR; a missing/corrupt file just means "no
  conversation yet".
"""

from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from typing import Iterator

from services.config import DATA_DIR
from services.json_file import read_json_object, write_json_file
from utils.log import logger

_PATH = DATA_DIR / "project_conversations.json"
_KEY_MAX = 200

_file_lock = threading.Lock()
_key_locks: dict[str, threading.Lock] = {}
_key_locks_guard = threading.Lock()


def normalize_key(value: object) -> str:
    key = str(value or "").strip()
    return key[:_KEY_MAX]


def _load() -> dict:
    try:
        data = read_json_object(_PATH, name="project_conversations")
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def get(key: str, account_email: str) -> str:
    """Conversation id recorded for this key + account, or ""."""
    if not key or not account_email:
        return ""
    with _file_lock:
        entry = _load().get(key)
    if not isinstance(entry, dict):
        return ""
    item = entry.get(account_email)
    if isinstance(item, dict):
        return str(item.get("conversation_id") or "")
    return ""


def remember(key: str, account_email: str, conversation_id: str) -> None:
    if not key or not account_email or not conversation_id:
        return
    with _file_lock:
        data = _load()
        entry = data.get(key)
        if not isinstance(entry, dict):
            entry = {}
        entry[account_email] = {"conversation_id": conversation_id, "updated_at": int(time.time())}
        data[key] = entry
        try:
            write_json_file(_PATH, data, backup=False)
        except Exception as exc:
            logger.warning({"event": "project_conversation_save_failed", "key": key, "error": str(exc)[:300]})


def forget(key: str, account_email: str) -> None:
    """Drop a conversation that no longer works (deleted/hidden on chatgpt.com)."""
    if not key or not account_email:
        return
    with _file_lock:
        data = _load()
        entry = data.get(key)
        if not isinstance(entry, dict) or account_email not in entry:
            return
        entry.pop(account_email, None)
        if entry:
            data[key] = entry
        else:
            data.pop(key, None)
        try:
            write_json_file(_PATH, data, backup=False)
        except Exception as exc:
            logger.warning({"event": "project_conversation_save_failed", "key": key, "error": str(exc)[:300]})


@contextmanager
def serialized(key: str, timeout_secs: float) -> Iterator[bool]:
    """Hold the key's lock for one image. Yields False if it could not be acquired in time."""
    if not key:
        yield False
        return
    with _key_locks_guard:
        lock = _key_locks.setdefault(key, threading.Lock())
    acquired = lock.acquire(timeout=max(0.0, timeout_secs))
    try:
        yield acquired
    finally:
        if acquired:
            lock.release()
