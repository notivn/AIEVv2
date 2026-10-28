// Chạy: npx tsx --test apps/server/src/imageProviders/parse.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { maskSecret, parseChatgptSession, parseGeminiCookies } from "./parse.js";

const JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJl";

test("chatgpt: nguyên JSON của /api/auth/session", () => {
  const session = JSON.stringify({
    user: { email: "a@b.c" },
    expires: "2026-12-01T00:00:00.000Z",
    accessToken: JWT,
  });
  assert.equal(parseChatgptSession(session), JWT);
});

test("chatgpt: chỉ accessToken, Bearer, có nháy", () => {
  assert.equal(parseChatgptSession(JWT), JWT);
  assert.equal(parseChatgptSession(`Bearer ${JWT}`), JWT);
  assert.equal(parseChatgptSession(`"${JWT}"`), JWT);
  assert.equal(parseChatgptSession(`Authorization: Bearer ${JWT}`), JWT);
});

test("chatgpt: JSON dán thiếu đuôi vẫn móc được token", () => {
  assert.equal(parseChatgptSession(`{"user":{},"accessToken":"${JWT}","sessionTo`), JWT);
});

test("chatgpt: không có token -> null", () => {
  assert.equal(parseChatgptSession(""), null);
  assert.equal(parseChatgptSession("xin chào"), null);
  assert.equal(parseChatgptSession('{"user":{"email":"a@b.c"}}'), null);
  assert.equal(parseChatgptSession(42), null);
});

test("gemini: psid + psidts tách sẵn", () => {
  assert.deepEqual(parseGeminiCookies({ psid: " g.a000abcdefghijk ", psidts: "sidts-CjEBxyz123" }), {
    psid: "g.a000abcdefghijk",
    psidts: "sidts-CjEBxyz123",
  });
  assert.deepEqual(parseGeminiCookies({ psid: "__Secure-1PSID=g.a000abcdefghijk" }), {
    psid: "g.a000abcdefghijk",
    psidts: null,
  });
});

test("gemini: cả chuỗi header Cookie", () => {
  const header =
    "Cookie: SID=abc; __Secure-1PSID=g.a000abcdefghijk; __Secure-1PSIDTS=sidts-CjEBxyz123; NID=1";
  assert.deepEqual(parseGeminiCookies({ cookie: header }), {
    psid: "g.a000abcdefghijk",
    psidts: "sidts-CjEBxyz123",
  });
});

test("gemini: bảng Cookies của DevTools (tab)", () => {
  const table = "__Secure-1PSID\tg.a000abcdefghijk\t.google.com\t/\n__Secure-1PSIDTS\tsidts-CjEBxyz123\t.google.com";
  assert.deepEqual(parseGeminiCookies({ cookie: table }), {
    psid: "g.a000abcdefghijk",
    psidts: "sidts-CjEBxyz123",
  });
});

test("gemini: thiếu PSID -> null", () => {
  assert.equal(parseGeminiCookies({ cookie: "SID=abc; NID=1" }), null);
  assert.equal(parseGeminiCookies({ psid: "" }), null);
  assert.equal(parseGeminiCookies({ psid: "has space inside value" }), null);
  assert.equal(parseGeminiCookies({}), null);
});

test("maskSecret", () => {
  assert.equal(maskSecret("g.a000abcdefghijklmnop"), "g.a000…mnop");
  assert.equal(maskSecret("short"), "sho…");
});
