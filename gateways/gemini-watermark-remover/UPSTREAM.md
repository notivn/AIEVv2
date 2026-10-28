# gateways/gemini-watermark-remover - vendored (MIT)

Gỡ logo sparkle NHÌN THẤY ở góc dưới phải ảnh do **Gemini web** sinh ra. Không gỡ được
SynthID (watermark vô hình của Google) - ảnh vẫn truy vết được là do AI tạo.

- Repo upstream: https://github.com/GargantuaX/gemini-watermark-remover (gói npm `@pilio/gemini-watermark-remover`)
- Commit: `bef0303a437902286a18ab4d1586629f198b90b7` (version `1.0.41`)
- Giấy phép: **MIT** (`LICENSE`, hai chủ thể bản quyền: Jad + AllenK) - KHÁC hai thư mục AGPL bên cạnh.
- Lấy qua bản pin trong repo SEO-GEO (`vendor/gemini-watermark-remover`), ngày vào AIEV 2026-10-27.

## Đã chép

Đúng 50 file `src/sdk/image-data.js` + `src/core/*.js` - tập module tĩnh reachable từ
`src/sdk/image-data.js`, không import ngoài, không đụng DOM. Giữ PRISTINE, không sửa dòng nào.
Không cài gói npm (~47 MB vì kèm model ONNX cho xóa watermark VIDEO - AIEV không dùng).

File KHÔNG thuộc upstream: `package.json` (vỏ `"type": "module"` để Node hiểu ESM),
`aiev-worker.mjs` (worker thread của AIEV), `UPSTREAM.md`.

## Cách AIEV dùng

`removeGeminiWatermark` trong `apps/server/src/imageProviders/postprocess.ts`: ffmpeg giải mã ảnh → RGBA thô → worker thread →
ffmpeg mã hóa lại PNG, rồi mới cover-fit về kích thước khung. FAIL-OPEN: lỗi gì cũng giữ ảnh gốc.
Chỉ chạy cho provider `gemini-web` (ảnh sạch là ca tốn CPU nhất, quét ảnh ChatGPT là phí).

## Cập nhật

Clone upstream ở commit mới, resolve lại import tĩnh từ `src/sdk/image-data.js`, xóa `src/` ở đây
rồi chép tập file mới, chép lại `LICENSE`, cập nhật mục trên.
