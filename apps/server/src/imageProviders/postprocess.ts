import fs from "node:fs";
import { spawn } from "node:child_process";
import { Worker } from "node:worker_threads";
import { childEnv } from "../config.js";
import { ffmpegSafeArgs, ffprobeSafeArgs } from "../ffmpegSafe.js";
import { killTree } from "../util.js";
import { gatewayPaths } from "./runtime.js";

/**
 * Hậu kỳ ảnh AI - chạy cho MỌI provider:
 *  1. (chỉ Gemini web) gỡ logo sparkle nhìn thấy ở góc dưới phải - PHẢI làm
 *     trên đúng pixel gốc, TRƯỚC khi scale (phép đảo alpha cần từng pixel).
 *  2. cover-fit bằng ffmpeg về ĐÚNG kích thước khung (1080x1920...). Gateway web
 *     không có tham số kích thước thật - ChatGPT/Gemini web trả tỉ lệ gần đúng,
 *     nên không cover-fit thì scene ảnh lệch khung, Remotion phải tự đoán cách
 *     lấp viền.
 */

interface RunResult {
  code: number | null;
  stdout: Buffer;
  stderr: string;
}

/** spawn giữ stdout NHỊ PHÂN (execFileCapture của util.ts đổi sang utf8 - hỏng RGBA) */
function runBinary(file: string, args: string[], stdin: Buffer | null, timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, env: childEnv() });
    const out: Buffer[] = [];
    let stderr = "";
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      killTree(child);
      reject(new Error(`${file} quá ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdout.on("data", (c: Buffer) => out.push(c));
    child.stderr.on("data", (c: Buffer) => {
      if (stderr.length < 8000) stderr += c.toString("utf8");
    });
    child.on("error", (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ code, stdout: Buffer.concat(out), stderr });
    });
    child.stdin.on("error", () => {
      /* ffmpeg đóng stdin sớm khi lỗi - lỗi thật đọc ở mã thoát */
    });
    if (stdin) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

export async function imageSize(file: string): Promise<{ width: number; height: number } | null> {
  try {
    const r = await runBinary(
      "ffprobe",
      ffprobeSafeArgs(["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0:s=x", file]),
      null,
      30_000,
    );
    const m = /^(\d+)x(\d+)/.exec(r.stdout.toString("utf8").trim());
    return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
  } catch {
    return null;
  }
}

/**
 * Cover-fit `input` về đúng width x height, ghi PNG vào `output` (được phép
 * trùng input). Lỗi → ném (ảnh sai kích thước là lỗi thật của bước tạo ảnh).
 */
export async function coverFit(input: string, output: string, width: number, height: number): Promise<void> {
  const tmp = `${output}.fit-${process.pid}-${Date.now()}.png`;
  const r = await runBinary(
    "ffmpeg",
    ffmpegSafeArgs([
      "-y",
      "-v",
      "error",
      "-i",
      input,
      "-vf",
      `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`,
      "-frames:v",
      "1",
      "-update",
      "1",
      tmp,
    ]),
    null,
    120_000,
  );
  if (r.code !== 0 || !fs.existsSync(tmp)) {
    fs.rmSync(tmp, { force: true });
    throw new Error(`ffmpeg không cover-fit được ảnh: ${r.stderr.trim().slice(-300) || `mã ${r.code}`}`);
  }
  fs.renameSync(tmp, output);
}

// ---------------------------------------------------------------------------
// Gỡ watermark Gemini (gateways/gemini-watermark-remover, MIT) - FAIL-OPEN
// ---------------------------------------------------------------------------

/** Trên mức này bỏ qua: ảnh sạch 4K đã tốn ~5s CPU */
const MAX_PIXELS = 40_000_000;
const WATERMARK_TIMEOUT_MS = 30_000;

/**
 * Gỡ logo sparkle nhìn thấy của Gemini, ghi đè `file` bằng PNG đã gỡ.
 * FAIL-OPEN TUYỆT ĐỐI: ảnh AI mất cả phút và tốn lượt mới có - một bước làm
 * đẹp phụ không được nuốt mất nó. Lỗi gì cũng giữ nguyên file, trả lý do.
 * Chỉ gỡ được dấu NHÌN THẤY; SynthID (vô hình) thì không công cụ nào gỡ được.
 */
export async function removeGeminiWatermark(file: string): Promise<{ removed: boolean; reason?: string }> {
  if (!fs.existsSync(gatewayPaths.watermarkWorker)) return { removed: false, reason: "thiếu bộ gỡ watermark" };
  try {
    const size = await imageSize(file);
    if (!size) return { removed: false, reason: "không đọc được kích thước ảnh" };
    if (size.width * size.height > MAX_PIXELS) return { removed: false, reason: "ảnh quá lớn" };
    const decoded = await runBinary(
      "ffmpeg",
      ffmpegSafeArgs(["-v", "error", "-i", file, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"]),
      null,
      60_000,
    );
    const expected = size.width * size.height * 4;
    if (decoded.code !== 0 || decoded.stdout.length !== expected) {
      return { removed: false, reason: `giải mã RGBA lỗi (${decoded.stdout.length}/${expected} byte)` };
    }
    const result = await runWatermarkWorker(size.width, size.height, decoded.stdout);
    if (!result.applied) return { removed: false, reason: result.skipReason ?? "không thấy watermark" };
    const tmp = `${file}.wm-${process.pid}.png`;
    const enc = await runBinary(
      "ffmpeg",
      ffmpegSafeArgs([
        "-y",
        "-v",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgba",
        "-s",
        `${result.width}x${result.height}`,
        "-i",
        "-",
        "-frames:v",
        "1",
        "-update",
        "1",
        tmp,
      ]),
      result.buffer,
      60_000,
    );
    if (enc.code !== 0 || !fs.existsSync(tmp)) {
      fs.rmSync(tmp, { force: true });
      return { removed: false, reason: `mã hóa lại PNG lỗi: ${enc.stderr.trim().slice(-200)}` };
    }
    fs.renameSync(tmp, file);
    return { removed: true };
  } catch (err) {
    return { removed: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function runWatermarkWorker(
  width: number,
  height: number,
  rgba: Buffer,
): Promise<{ width: number; height: number; buffer: Buffer; applied: boolean; skipReason: string | null }> {
  return new Promise((resolve, reject) => {
    // Worker riêng cho mỗi ảnh: tạo ảnh chỉ vài lần/phút, giữ worker sống là tốn RAM vô ích
    const w = new Worker(gatewayPaths.watermarkWorker);
    const timer = setTimeout(() => {
      void w.terminate();
      reject(new Error("gỡ watermark quá thời gian"));
    }, WATERMARK_TIMEOUT_MS);
    const finish = () => {
      clearTimeout(timer);
      void w.terminate();
    };
    w.once("message", (msg: Record<string, unknown>) => {
      finish();
      if (msg.ok !== true) {
        reject(new Error(String(msg.error ?? "worker lỗi")));
        return;
      }
      resolve({
        width: Number(msg.width),
        height: Number(msg.height),
        buffer: Buffer.from(msg.buffer as ArrayBuffer),
        applied: msg.applied === true,
        skipReason: typeof msg.skipReason === "string" ? msg.skipReason : null,
      });
    });
    w.once("error", (err) => {
      finish();
      reject(err);
    });
    // Copy sang ArrayBuffer riêng rồi transfer (Buffer của Node có thể nằm trong pool chung)
    const ab = rgba.buffer.slice(rgba.byteOffset, rgba.byteOffset + rgba.byteLength) as ArrayBuffer;
    w.postMessage({ id: 1, width, height, buffer: ab }, [ab]);
  });
}
