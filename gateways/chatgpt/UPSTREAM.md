# gateways/chatgpt - vendored chatgpt2api (AGPL-3.0)

Bản sao phần **backend Python** của [yukkcat/chatgpt2api](https://github.com/yukkcat/chatgpt2api),
lấy từ bản pin trong repo SEO-GEO (`chatgpt-gateway/upstream`). AIEV dùng nó để tạo ảnh bằng
tài khoản ChatGPT web, chạy thành **tiến trình riêng** (uvicorn trên `127.0.0.1:6871`) do
backend AIEV tự bật/tắt (`apps/server/src/imageProviders/chatgptGateway.ts`).

## Thông tin bản vendor

- Repo upstream: https://github.com/yukkcat/chatgpt2api
- Commit: `9d3e6fc43187c6e2670d93c70d0a700f8b40c1a6` (VERSION `3.2.2`)
- Giấy phép: **AGPL-3.0-only** (`LICENSE`), kèm phần MIT gốc của basketikun/chatgpt2api (`NOTICE`)
- Ngày vendor vào AIEV: 2026-10-27

## Đã chép những gì

`main.py`, `api/`, `services/`, `contracts/`, `utils/`, `pyproject.toml`, `VERSION`, `LICENSE`, `NOTICE`
- giữ nguyên cấu trúc thư mục, không sửa logic.

CỐ Ý bỏ: `web-vue/` (console quản trị - AIEV có trang Kết nối riêng), `scripts/` (upscale bằng
sharp/Node), `deploy/`, `Dockerfile`, `docker-compose*.yml`, `docs/`, `tests/`, `uv.lock` (ghim
thư viện có lỗ hổng + kéo psycopg2), README/CHANGELOG/AGENTS.

## Thay đổi so với upstream

| File | Thay đổi | Vì sao |
|---|---|---|
| `services/config.py` | `DATA_DIR` / `CONFIG_FILE` đọc env `CHATGPT2API_DATA_DIR` / `CHATGPT2API_CONFIG_FILE`, thiếu env thì về đúng giá trị cũ (`<gốc>/data`, `<gốc>/config.json`). 2 dòng, đánh dấu `AIEV PATCH`. | Upstream ghi dữ liệu tài khoản (token!) vào ngay thư mục mã nguồn. AIEV để nó ở `.runtime/chatgpt-gateway/` (gitignore) - không bao giờ lọt vào commit, xóa được cùng `.runtime/`. |
| `services/openai_backend_api.py`, `utils/pow.py` | `Accept-Language` / `OAI-Language` / dấu vân tay PoW `language−…`: `zh-CN` → `vi-VN`; `timezone` `Asia/Shanghai` → `Asia/Ho_Chi_Minh`, `timezone_offset_min` `-480` → `-420`. | ChatGPT đặt tiêu đề hội thoại và viết thông báo đẩy ("你的图片已可查看") theo ngôn ngữ phiên - người dùng thấy chữ Hán trên điện thoại. |
| `services/protocol/conversation.py` `build_image_prompt` | Bỏ câu `输出图片质量为 …`; câu kích thước đổi sang tiếng Anh (`Output image size: …`). | Câu tiếng Trung nhồi vào mọi prompt ảnh. |
| `api/ai.py`, `services/protocol/openai_v1_image_generations.py`, `services/protocol/conversation.py`, `services/openai_backend_api.py` | `/v1/images/generations` nhận `conversation_key` + `conversation_title`: ảnh cùng khóa nối tiếp MỘT hội thoại ChatGPT (theo từng tài khoản), đặt tên hội thoại, không ẩn sau khi xong; lượt cùng khóa chạy lần lượt; lúc nối tiếp bỏ qua tin nhắn/tác vụ đã có (tìm kết quả quét CẢ hội thoại - không lọc là trả về ảnh cũ). Đánh dấu `AIEV PATCH`. | Mỗi ảnh một hội thoại làm rác lịch sử chat - AIEV gửi khóa `aiev:<project>`. |
| `services/protocol/conversation.py` `_generate_single_image` | Ảnh trong hội thoại nối tiếp hỏng với lỗi thuộc `_FRESH_CONVERSATION_RETRY_CODES` (trả lời bằng chữ, không có ảnh, lỗi công cụ ảnh…) -> thử lại MỘT lần cùng tài khoản trong hội thoại MỚI, giữ nguyên slot ảnh của tài khoản (thử lại trước `finalize_image_slot`). Thành công thì hội thoại mới thay hội thoại cũ trong `project_conversations`. Đánh dấu `AIEV PATCH`. | Hội thoại dồn nhiều ảnh cũ thì ChatGPT hay hiểu prompt mới là "sửa ảnh cũ" rồi trả lời bằng chữ ("công cụ tạo ảnh đang gặp sự cố"). Câu dặn "Create a NEW image…" không đủ chặn. |

File THÊM (không thuộc upstream): `services/project_conversations.py` (khóa → hội thoại, lưu `DATA_DIR/project_conversations.json`), `aiev_launcher.py` (chạy `main:app` bằng uvicorn, bind
`127.0.0.1`, tự thoát khi stdin đóng = server AIEV chết), `UPSTREAM.md` (file này).

Không có patch chống bot/anti-detect nào của AIEV - mọi thứ đó là của upstream, dùng nguyên.

## Chạy không cần Docker/Postgres

- Gói Python: `gateways/requirements.txt` (= dependencies của `pyproject.toml` **trừ `psycopg2-binary`**,
  cận dưới/trên theo lock đã vá của SEO-GEO) + `gemini-webapi` cho `gateways/gemini-web`.
- Venv riêng `.runtime/venv-gateway` (Python >= 3.13), dựng bằng `node start/doctor.mjs --fix-one image-gateway`
  hoặc nút "Cài tự động" mục *Image gateway* ở trang Cấu hình.
- Server AIEV đặt env khi spawn: `CHATGPT2API_AUTH_KEY` (= `CHATGPT_GATEWAY_KEY` tự sinh trong `.env`),
  `CHATGPT2API_DATA_DIR`, `CHATGPT2API_CONFIG_FILE`, `DATABASE_URL=sqlite:///.runtime/chatgpt-gateway/data/chatgpt2api.db`.
  Mọi biến có chữ KEY/TOKEN/SECRET/PASSWORD khác của AIEV bị lọc khỏi env của tiến trình này.

## Chuỗi tiếng Trung

Không dịch thông báo lỗi trong mã nguồn. Ngoại lệ: chuỗi GỬI LÊN ChatGPT (prompt, ngôn ngữ phiên) - xem bảng trên. Thông báo lỗi upstream được dịch sang tiếng Việt ở
biên Node: `translateGatewayError` trong `apps/server/src/imageProviders/errors.ts`. Còn sót chữ Hán chưa khớp luật nào thì thay
bằng câu chung tiếng Việt - không bao giờ để chữ Hán lọt ra UI.

## Cập nhật lên commit mới

1. Lấy cây mã upstream mới (từ GitHub hoặc repo SEO-GEO), chép đè ĐÚNG danh sách "Đã chép" ở trên.
2. Áp lại patch `services/config.py` (tìm `DATA_DIR = BASE_DIR / "data"`) và mọi chỗ `AIEV PATCH` / bảng trên (grep `AIEV PATCH`, `zh-CN`, `Asia/Shanghai`).
3. So `pyproject.toml` mới với `gateways/requirements.txt`, cập nhật cận nếu cần.
4. Smoke test: bật sidecar, `GET /v1/models` có `gpt-image-2`, `POST /api/accounts {tokens:["fake"]}`
   phải trả `errors[0].code = "auth_invalid"` và tự gỡ tài khoản (AIEV dịch thành `GATEWAY_AUTH_FAILED`).
5. Cập nhật mục "Thông tin bản vendor".
