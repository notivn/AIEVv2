/**
 * Worker thread gỡ watermark Gemini (GLUE CỦA AIEV, không phải mã upstream).
 *
 * removeWatermarkFromImageDataSync() của thư viện là hàm ĐỒNG BỘ, nặng CPU
 * (ảnh 1K ~0,3-1s, ảnh sạch 4K tới ~5s) - chạy ở luồng chính của server là
 * đứng hình cả SSE lẫn hàng đợi render. Lớp gọi:
 * removeGeminiWatermark trong apps/server/src/imageProviders/postprocess.ts
 * (nạp file này bằng đường dẫn).
 *
 * Message vào : { id, width, height, buffer }  (ArrayBuffer RGBA)
 * Message ra  : { id, ok: true, buffer, applied, skipReason } | { id, ok: false, error }
 */
import { parentPort } from "node:worker_threads";

if (!parentPort) throw new Error("aiev-worker.mjs phải chạy trong worker thread");
const port = parentPort;

let sdkPromise = null;
const loadSdk = () => (sdkPromise ??= import("./src/sdk/image-data.js"));

port.on("message", async (msg) => {
  const id = msg?.id;
  try {
    const { removeWatermarkFromImageDataSync } = await loadSdk();
    const result = removeWatermarkFromImageDataSync({
      width: msg.width,
      height: msg.height,
      data: new Uint8ClampedArray(msg.buffer),
    });
    const meta = result.meta || {};
    const out = result.imageData.data;
    const outBuffer =
      out.byteOffset === 0 && out.byteLength === out.buffer.byteLength
        ? out.buffer
        : out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    port.postMessage(
      {
        id,
        ok: true,
        width: result.imageData.width,
        height: result.imageData.height,
        buffer: outBuffer,
        applied: meta.applied === true,
        skipReason: meta.skipReason ?? null,
      },
      [outBuffer],
    );
  } catch (err) {
    port.postMessage({ id, ok: false, error: String(err) });
  }
});
