# Trình chỉnh sửa v2 + hai chế độ dựng + gateway tạo ảnh - kế hoạch & hợp đồng kỹ thuật

> Bổ sung cho `docs/EDITOR-PLAN.md` (v1). File này là HỢP ĐỒNG giữa các luồng làm song song: tên field,
> endpoint, mã lỗi ở đây là chốt - luồng nào cần đổi thì sửa file này trước.

## 0. Mục tiêu

1. **Trình chỉnh sửa mạnh** để người dùng tự điều khiển: kéo thả file từ máy vào, chỉnh màu, khung hình
   (vị trí/cỡ/xoay/cắt/lật), âm lượng + fade, tốc độ, kiểu chuyển cảnh, **layer chồng** (ảnh/video
   PiP/chữ/khối màu) có hiệu ứng vào/ra + keyframe, kéo-thả trực tiếp trên khung xem trước.
2. **Hai chế độ chuyển qua lại tự do**:
   - *AI làm* - AI dựng; mặc định dừng ở **bản nháp** để người dùng duyệt (tùy chọn: AI làm trọn tới final).
   - *Tôi giám sát* - người dùng chỉnh trong trình chỉnh sửa; bấm **Giao cho AI** để AI làm tiếp từ đúng
     trạng thái hiện tại; AI xong thì người dùng **Giữ** hoặc **Hoàn tác**; ưng thì **Xuất video**.
3. **Tạo ảnh / cảnh trám** qua ba nhà cung cấp: Gemini API (có sẵn), **ChatGPT (tài khoản web)**,
   **Gemini (cookie web)** - cấu hình ở trang Kết nối, dùng được trong trình chỉnh sửa và cho AI.

Nguyên tắc giữ nguyên: `meta.json` là nguồn sự thật; preview và render dùng CHUNG composition `Assemble`
(thêm gì vào engine phải hiện giống hệt ở Player và CLI); trình duyệt không mã hóa video; mọi render đi qua
render queue; draft trước final.

## 1. Mô hình dữ liệu timeline (luồng A + B)

Mọi field mới là TÙY CHỌN - thiếu field = hành vi cũ, project cũ không đổi gì.

### 1.1 Scene - field mới

```ts
fit?: "cover" | "contain"                 // mặc định "cover" (hiện tại hard-code cover)
transform?: {
  x?: number      // dịch ngang, tỉ lệ theo chiều rộng khung, -1..1, mặc định 0
  y?: number      // dịch dọc, tỉ lệ theo chiều cao khung, -1..1, mặc định 0
  scale?: number  // 0.1..5, mặc định 1 (nhân thêm với zoom/punch-in sẵn có)
  rotate?: number // độ, -180..180, mặc định 0
  flipH?: boolean
  flipV?: boolean
}
crop?: { top?: number; right?: number; bottom?: number; left?: number }  // tỉ lệ 0..0.45 mỗi cạnh
color?: ColorAdjust                         // xem 1.3
volume?: number      // footage: 0..2, mặc định 1 (muted=true vẫn thắng)
fadeInSec?: number   // footage: fade âm thanh vào, 0..10
fadeOutSec?: number  // footage: fade âm thanh ra, 0..10
speed?: number       // footage: 0.25..4, mặc định 1. Thời lượng = (to - from) / speed
transition?: { type: TransitionType }      // áp dụng trong khoảng transitionOverlap sẵn có
```

`TransitionType = "fade" | "slide-left" | "slide-right" | "slide-up" | "slide-down" | "wipe-left" |
"wipe-right" | "zoom-in" | "zoom-out" | "blur" | "none"` - mặc định `"fade"` (đúng hành vi cũ).
Tự viết trong `Transition.tsx` bằng interpolate (không thêm `@remotion/transitions`).

**Tốc độ** đụng công thức thời lượng ở 5 nơi - phải sửa CẢ 5 bằng một helper dùng chung:
`engines/remotion/src/manifest.ts`, `apps/web/src/components/editor/PreviewPlayer.tsx`,
`apps/server/src/jobs/assemble.ts`, `apps/server/src/timeline.ts` (`layoutScenes`),
`apps/web/src/components/editor/ops.ts` (`footageWindow`/trim/split). `OffthreadVideo playbackRate={speed}`.

### 1.2 Layer - key cấp cao mới `layers[]`

Thêm `"layers"` vào `TIMELINE_KEYS` (server) và mọi nơi liệt kê key (xem báo cáo §5: `timelineForClient`,
validate, `referencedMediaPaths`, staging trong assemble, `changedKeysPatch`, `normalizeTimeline`, object
`raw` trong `buildPreviewManifest`, FCP7 export bỏ qua được).

```ts
type Layer = {
  id: string                       // duy nhất trong layers[]
  kind: "image" | "video" | "text" | "shape"
  from: number                     // frame tuyệt đối (như cues)
  durationInFrames: number         // >= 1
  src?: string                     // image/video: đường dẫn trong project (vd "assets/x.png")
  mediaStart?: number              // video: giây bắt đầu trong file
  muted?: boolean                  // video: mặc định true
  volume?: number                  // video: 0..2
  text?: string                    // text: cho phép xuống dòng
  style?: {                        // text + shape
    fontFamily?: string; fontSizePx?: number; fontWeight?: number; color?: string;
    align?: "left" | "center" | "right"; lineHeight?: number;
    backgroundColor?: string; paddingPx?: number; radiusPx?: number;
    strokeColor?: string; strokeWidthPx?: number; shadow?: boolean;
  }
  width?: number                   // bề rộng hộp, tỉ lệ theo chiều rộng khung 0.05..2, mặc định 0.5
  aspect?: number                  // shape: tỉ lệ rộng/cao, mặc định 16/9. image/video lấy từ file
  transform?: { x?: number; y?: number; scale?: number; rotate?: number; flipH?: boolean; flipV?: boolean }
                                   // x/y = vị trí TÂM hộp, tỉ lệ -1..1 tính từ tâm khung (0,0 = giữa)
  opacity?: number                 // 0..1, mặc định 1
  fit?: "cover" | "contain"        // image/video bên trong hộp, mặc định "cover"
  crop?: { top?: number; right?: number; bottom?: number; left?: number }
  color?: ColorAdjust
  radiusPx?: number                // bo góc image/video
  animation?: { in?: LayerAnim; out?: LayerAnim; durationSec?: number }  // durationSec mặc định 0.4
  keyframes?: Array<{ frame: number; x?: number; y?: number; scale?: number; rotate?: number;
                      opacity?: number; ease?: "linear" | "in" | "out" | "inOut" }>
                                   // frame TƯƠNG ĐỐI so với layer.from; nội suy từng thuộc tính
}
type LayerAnim = "none" | "fade" | "slide-up" | "slide-down" | "slide-left" | "slide-right" | "pop" | "zoom"
```

Thứ tự vẽ: scenes → **layers (theo thứ tự mảng, phần tử sau nằm trên)** → highlight/subtitle/caption →
watermark. Hình học hộp phải tính bằng MỘT hàm thuần dùng chung (`engines/remotion/src/layerGeometry.ts`:
`layerBox(layer, frame, frameW, frameH, mediaAspect) → {cx, cy, w, h, rotate, opacity}`) - lớp kéo-thả
trên khung xem trước của trình chỉnh sửa import đúng hàm này để khung chọn khớp pixel với hình.

### 1.3 ColorAdjust (scene + layer)

```ts
type ColorAdjust = {
  preset?: string        // id preset của apps/server/src/color.ts (14 preset) - render bằng xấp xỉ CSS
  brightness?: number    // -1..1, 0 = giữ nguyên
  contrast?: number      // -1..1
  saturation?: number    // -1..1  (-1 = đen trắng)
  temperature?: number   // -1..1  (âm = lạnh/xanh, dương = ấm/cam)
  tint?: number          // -1..1  (âm = xanh lá, dương = hồng)
  hue?: number           // độ -180..180
  vignette?: number      // 0..1
  blur?: number          // px 0..20
}
```

Render bằng CSS `filter` + một `<svg><filter><feColorMatrix>` inline cho temperature/tint + lớp vignette
radial-gradient. Đặt trong `engines/remotion/src/color.ts` (`colorFilterCss(adj)`, `ColorDefs`), dùng cho
cả scene lẫn layer. Xấp xỉ preset lấy từ `cssApprox` (ProjectAssetsCard.tsx) chuyển vào đây và cho web dùng
lại. Đây là chỉnh màu TRÊN TIMELINE (không đổi file); tính năng grade asset bằng ffmpeg giữ nguyên.

### 1.4 Âm thanh

`sfx[]` thêm `fadeInSec?`, `fadeOutSec?`. `audio.music` thêm `fadeInSec?`, `fadeOutSec?` (ghi đè hằng số
0.5s/1s hiện tại khi có).

### 1.5 Validate (server `apps/server/src/timeline.ts`)

Mọi field mới được validate kiểu + khoảng (ngoài khoảng → 400 `INVALID_TIMELINE` kèm `issues`, giống hiện
tại). Đường dẫn media mới (`layers[].src`) phải qua đúng kiểm tra traversal + phải nằm trong project, được
staging trong `assemble.ts` và có trong `referencedMediaPaths`. Field lạ vẫn giữ nguyên (không xóa).

## 2. Trình chỉnh sửa (luồng B) - tính năng bắt buộc

1. **Kéo thả file từ máy** vào bất kỳ đâu trong trình chỉnh sửa (bỏ chặn ở VideoEditor.tsx ~1158): tải lên
   bằng `uploadAsset(file, "project", id)` (tuần tự, có tiến độ), rồi: thả lên track Video → chèn scene tại
   vị trí thả; thả lên track Layer → thêm layer tại frame thả; thả chỗ khác → chỉ vào thư viện. Thư viện
   có nút **Tải lên**. Ảnh → scene ảnh 3s / layer ảnh; video → scene footage / layer video; audio → sfx.
2. **Track Layer** (đặt ngay dưới Video): các layer chồng thời gian xếp thành nhiều làn (tự xếp làn). Kéo để
   dời, kéo mép để đổi thời lượng, chia đôi (S), nhân bản, xóa, đưa lên/xuống lớp (Ctrl+] / Ctrl+[).
   Nút "+" thêm layer chữ / khối màu tại playhead.
3. **Thao tác trực tiếp trên khung xem trước**: chọn layer (hoặc scene) → hiện khung có tay nắm: kéo để dời,
   kéo góc để đổi cỡ (giữ tỉ lệ), tay nắm xoay; Shift = khóa trục / bước 15°. Bấm vào hình trên khung chọn
   layer trên cùng tại điểm đó. Dùng `layerBox` dùng chung để khung khớp hình. Mỗi lần kéo = 1 bước undo.
4. **Inspector scene**: Khung hình (fit, x/y/scale/xoay, lật, cắt 4 cạnh, nút Đặt lại) · Màu (chip preset +
   thanh trượt từng thông số + Đặt lại) · Âm thanh (âm lượng, fade vào/ra) · Tốc độ (0.25-4x, chỉ footage) ·
   Chuyển cảnh (kiểu + độ dài overlap sẵn có).
5. **Inspector layer**: Nội dung (file / chữ + font/cỡ/đậm/màu/căn/nền/viền/bóng) · Khung hình · Độ mờ ·
   Màu · Hiệu ứng vào/ra + thời lượng · Keyframe (thêm keyframe tại playhead cho vị trí/cỡ/xoay/độ mờ, danh
   sách keyframe, xóa) · Âm thanh (video layer).
6. **Sao chép / dán** mục đang chọn (Ctrl+C / Ctrl+V tại playhead) cho scene, layer, cue, sfx.
7. **Tạo ảnh AI / cảnh trám** - tab "AI" trong thư viện: ô mô tả, chọn nhà cung cấp (Tự động / Gemini API /
   ChatGPT / Gemini web, chỉ hiện cái đã cấu hình), nút **Chèn làm cảnh trám** (scene ảnh tại playhead,
   3s, punch-in nhẹ) và **Thêm làm layer**. Gọi API ở §4.4, hiện tiến độ, lỗi rõ ràng, ảnh xong vào thư viện.
8. **Giao cho AI** (thanh trên): hộp thoại nhập yêu cầu → `POST /api/projects/:id/editor/handoff` (§3). Trong
   lúc AI chạy trình chỉnh sửa chỉ đọc (cơ chế `agentBusy` sẵn có) và hiện tiến độ; AI xong → banner
   "AI đã chỉnh xong" với **Giữ** / **Hoàn tác** (khôi phục revision `ai-before` sẵn có) / **Xem lịch sử**.
9. **Xuất video**: nút chính trên thanh trên = render final qua queue (luật draft→final giữ nguyên; thiếu
   draft thì server tự xếp draft trước - giữ hành vi route render hiện có).
10. Phím tắt mới vào ShortcutsModal. Mọi chuỗi qua i18n (vi + en). UI tuân thủ skill `webui-design`.

## 3. Hai chế độ (luồng E)

- `brief.finishMode?: "draft" | "final"` - **mặc định `"draft"`**. `"draft"`: phiên AI edit dừng khi có bản
  draft đã QC (không render final). `"final"`: như hiện tại (AI làm trọn tới final).
- Phiên AI edit khi `finishMode="draft"` dùng `goal='draft'`: gate trong `agent.ts` coi là xong khi có job
  `assemble-draft` thành công mới hơn lúc bắt đầu phiên (và QC đã chạy), prompt (`editPrompt.ts`) nói rõ
  CẢ HAI chiều: draft → "KHÔNG render final, dừng ở draft để người dùng duyệt"; final → như cũ.
- Trang project: điều khiển `Segmented` cạnh nút "Bắt đầu edit bằng AI": **AI dựng nháp, tôi duyệt** /
  **AI làm trọn tới final**. Khi có draft mà chưa final: khối "Bản nháp sẵn sàng" với **Mở trình chỉnh sửa**
  và **Xuất final**.
- `POST /api/projects/:id/editor/handoff {instruction: string, finishMode?: "draft"|"final"}` → 202
  `{sessionId}`. Mở phiên AI edit (goal theo finishMode, mặc định draft) tiếp tục từ timeline hiện tại: prompt
  = prompt edit chuẩn + "Người dùng đã tự chỉnh timeline - đọc lại meta.json, GIỮ các chỉnh sửa tay, làm tiếp
  theo yêu cầu: ...". Tạo snapshot `ai-before` trước khi agent chạy. 409 `AGENT_BUSY` nếu đang có phiên chạy.

## 4. Gateway tạo ảnh (luồng C + D)

### 4.1 Mã nguồn & giấy phép

- `gateways/chatgpt/` - vendored `yukkcat/chatgpt2api` (bản pin trong repo SEO-GEO, không sửa logic), chỉ
  phần backend Python (`main.py`, `api/`, `services/`, `contracts/`, `utils/`, `pyproject.toml`, lock),
  kèm `LICENSE` (AGPL-3.0) + `NOTICE` + `UPSTREAM.md` (nguồn, commit, cách cập nhật).
- `gateways/gemini-web/worker.py` - worker JSON-lines dùng `gemini-webapi` (AGPL) - file mang header AGPL,
  thư mục có `LICENSE`. Phần còn lại của AIEV giữ MIT; README ghi rõ hai thư mục này AGPL, chạy thành tiến
  trình riêng.
- Venv riêng `.runtime/venv-gateway` (Python >= 3.13) cho cả hai, KHÔNG trộn với `.runtime/venv` (torch,
  vieneu). Doctor thêm mục `image-gateway` (optional, có nút cài một chạm).

### 4.2 Tiến trình

- ChatGPT: server tự bật sidecar khi cần (`uvicorn main:app --host 127.0.0.1 --port 6871`), key ngẫu nhiên
  `CHATGPT_GATEWAY_KEY` trong `.env` (tự sinh như `AIEV_API_TOKEN`), dữ liệu tài khoản trong
  `.runtime/chatgpt-gateway/` (gitignore). Health check, tự khởi động lại khi chết, tắt theo server.
  Token dán vào được chuyển thẳng sang admin API của gateway (`POST /api/accounts {tokens:[accessToken]}`),
  AIEV KHÔNG tự lưu token.
- Gemini web: worker sống lâu (mẫu `ttsLocal.ts` + `vieneu_worker.py`) để `auto_refresh` cookie chạy liên tục;
  cookie lưu `apps/server/data/gemini-web.json` (gitignore, không serve); cache cookie xoay vòng trỏ vào
  `.runtime/gemini-web/`. Không bao giờ khởi tạo client với PSID rỗng.
- Ảnh trả về luôn qua bước cover-fit bằng ffmpeg về đúng kích thước khung project (1080x1920, 1920x1080,
  1080x1080, 1080x1350). Ảnh Gemini web: bỏ `web_images`, chỉ lấy `generated_images`.

### 4.3 API

```
GET    /api/gateways/chatgpt                 → {installed, running, accounts:[{id, email?, plan?, status,
                                                 imageQuotaRemaining?, resetAt?, expiresAt?}]}
POST   /api/gateways/chatgpt/accounts {session} → 201 account   (session = JSON dán từ
                                                 https://chatgpt.com/api/auth/session HOẶC chỉ accessToken)
DELETE /api/gateways/chatgpt/accounts/:id    → 204
POST   /api/gateways/chatgpt/test            → {ok, message}
GET    /api/gateways/gemini-web              → {installed, configured, psidMasked?, status, lastOkAt?}
PUT    /api/gateways/gemini-web/cookies {psid, psidts?} | {cookie}  → {ok, message}  (cookie = cả chuỗi
                                                 header Cookie; tự tách __Secure-1PSID / __Secure-1PSIDTS)
DELETE /api/gateways/gemini-web/cookies      → 204
POST   /api/gateways/gemini-web/test         → {ok, message}
GET    /api/image-providers                  → {default, providers:[{id, label, configured, models:[...]}]}
PUT    /api/image-providers {default}        → {default}
```

Mã lỗi: `400 INVALID_SESSION` (không tìm thấy accessToken), `400 INVALID_COOKIE`, `503 GATEWAY_NOT_INSTALLED`,
`503 GATEWAY_UNAVAILABLE`, `401 GATEWAY_AUTH_FAILED` (token/cookie hết hạn), `429 GATEWAY_RATE_LIMITED`,
`504 GATEWAY_TIMEOUT`, `502 GATEWAY_FAILED`. Thông báo tiếng Việt, dịch lỗi tiếng Trung của upstream.

Provider id: `"gemini-api" | "chatgpt-web" | "gemini-web"`, cộng `"auto"` (thứ tự: provider mặc định → các
provider đã cấu hình còn lại). Giá trị model hiện có (`illustrationModel`, model Images Project…) giữ tương
thích: id model Gemini API cũ = provider `gemini-api`; giá trị mới dạng `"chatgpt-web"`, `"gemini-web"`,
`"auto"`.

### 4.4 Tạo ảnh từ trình chỉnh sửa (cảnh trám)

```
POST /api/projects/:id/generate-image {prompt, provider?, purpose: "filler"|"layer", allowText?}
     → 202 {taskId}
GET  /api/projects/:id/generate-image/:taskId → {status: "running"|"done"|"failed", relPath?, provider?,
                                                 error?:{code,message}, elapsedSec}
```

Chạy nền trong bộ nhớ (KHÔNG chiếm render queue - gateway có thể mất 30s-10 phút). Prompt đi qua
`buildImagePrompt` (Style Design + phong cách dựng như ảnh minh họa). Lưu `assets/generated/<slug>.png`.
Đây là thao tác TAY của người dùng nên không bị công tắc "Ảnh minh họa AI" chặn, nhưng trả
`409 AGENT_BUSY` khi có phiên AI đang chạy trên project (agent không dùng đường này để lách công tắc).

### 4.5 Gom đường tạo ảnh

`apps/server/src/imageProviders/` - `generateImage({prompt, aspect, outFile, provider?, model?, ...})`.
Mọi nơi đang gọi `generateBackground` (illustrations, imageGen, thumbnails, autoCut) đi qua đây. Công tắc
`ILLUSTRATIONS_DISABLED` giữ nguyên. Skill `ai-illustrations` + `editPrompt.ts` nói trung lập theo provider.

## 5. Phân luồng & quyền sở hữu file

| Luồng | Phạm vi | File chính (chỉ luồng này sửa) |
|---|---|---|
| A - Engine | Mô hình dữ liệu §1 trong engine + server | `engines/remotion/src/**`, `apps/server/src/timeline.ts`, `apps/server/src/jobs/assemble.ts`, `apps/server/src/routes/timeline.ts` (phần validate/preview), `apps/web/src/components/editor/PreviewPlayer.tsx`, skill `remotion-assemble` |
| B - Editor UI | §2 | `apps/web/src/components/editor/**` (trừ PreviewPlayer.tsx), mục timeline trong `apps/web/src/lib/api.ts`, khóa `editor.*` |
| C - Gateway backend | §4.1-4.5 | `gateways/**`, `apps/server/src/imageProviders/**`, `apps/server/src/routes/gateways.ts`, `routes/imageProviders.ts`, `routes/illustrations.ts`, `jobs/imageGen.ts`, `routes/thumbnails.ts`, `jobs/autoCut.ts` (chỉ phần ảnh nền), `routes/connections.ts`, `start/doctor.mjs`, `.gitignore`, skill `ai-illustrations` |
| D - Kết nối UI | Card gateway + chọn provider | `apps/web/src/app/connections/**`, `apps/web/src/components/BriefFields.tsx` + `ImageProjectForm.tsx` (bộ chọn model), mục connections trong `api.ts`, khóa `conn.*` |
| E - Hai chế độ | §3 | `apps/server/src/meta.ts`, `apps/server/src/agent.ts`, `apps/server/src/editPrompt.ts`, `apps/server/src/routes/projects.ts`, route handoff, `apps/web/src/app/projects/[id]/page.tsx`, skill `video-pipeline`, khóa `project.*` |

File dùng chung (`api.ts`, `vi.ts`/`en.ts`, `docs/API.md`, `apps/server/src/index.ts`): mỗi luồng chỉ chèn
vào đúng mục của mình, đọc lại file ngay trước khi sửa, không sắp xếp lại phần của luồng khác.

## 6. Kiểm chứng

`npm run typecheck`, `npm run build`, `node apps/web/scripts/check-design-system.mjs`,
`node apps/web/scripts/check-i18n.mjs` sạch. Có test thuần cho `layerBox`, công thức thời lượng có tốc độ,
`colorFilterCss`, tách token/cookie. Render CLI một still có layer + màu để chứng minh preview = render.
Gateway: cài venv, bật sidecar, nhập token giả → lỗi `GATEWAY_AUTH_FAILED` rõ ràng (kiểm thử với tài khoản
thật do người dùng tự làm - repo tham chiếu cũng ghi "chưa kiểm chứng").
