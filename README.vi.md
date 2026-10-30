# AIEV - AI Edit Video by [noti.vn](https://noti.vn)

[![CI](https://github.com/notivn/AIEVv2/actions/workflows/ci.yml/badge.svg)](https://github.com/notivn/AIEVv2/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)

[🇬🇧 English](README.md) · 🇻🇳 Tiếng Việt

> **Edit video tự động bằng AI.** Claude đóng vai đạo diễn - điều khiển **HyperFrames** (dựng scene motion-graphics bằng HTML + GSAP) và **Remotion** (lắp ráp timeline) - bạn giám sát mọi thứ qua web dashboard tại `http://localhost:6868`.

Đưa clip vào, mô tả ngắn gọn bạn muốn gì, bấm **"Bắt đầu edit bằng AI"** - hệ thống tự transcribe, lên kế hoạch dựng, tạo scene chữ động, phụ đề karaoke, zoom nhấn nhịp, sound effect theo timestamp, lắp ráp và xuất MP4. Cùng bộ máy đó còn biến bài viết thành video có thuyết minh, cắt video dài thành nhiều video ngắn và dịch video sang ngôn ngữ khác.

Trang nào trên dashboard cũng có nút **Hướng dẫn** ở thanh trên cùng: bấm vào là mở bảng bên phải, đúng phần hướng dẫn của trang đang xem, kèm menu để chọn đọc mục khác.

## Tính năng

| | |
|---|---|
| 🎬 **Edit video bằng AI** | Claude tự phân tích nguồn → dựng scene HyperFrames → lắp ráp Remotion → MP4. Draft trước, final sau, verify từng frame. |
| 🎞️ **Trình chỉnh sửa video** | Xem trước bản dựng ngay trong trình duyệt (chạy đúng composition Remotion, không cần render) và sửa trên timeline: đổi thứ tự/cắt/tách scene, sửa chữ karaoke, phụ đề, thẻ highlight, sound effect, nhạc nền - hoặc nhờ AI trong khung chat bên cạnh. Khóa track, lịch sử phiên bản, xuất sang Premiere Pro / DaVinci Resolve (XML). |
| 📰 **Text to video** | Dán URL hoặc văn bản → AI viết kịch bản văn nói chia đoạn → thuyết minh bằng Gemini TTS hoặc VieNeu-TTS chạy trên máy → thành video project để AI dựng. |
| ✂️ **Auto cut** | Một video nói chuyện dài → nhiều video ngắn, chia theo thời gian, theo highlight AI chọn hoặc theo prompt của bạn. Mỗi đoạn là một project riêng, dùng chung một Kịch bản edit. |
| 🌐 **Dịch video** | Lấy lời thoại, dịch sang ngôn ngữ bạn chọn, rồi in phụ đề đã dịch, lồng tiếng giọng mới, hoặc cả hai. |
| 🎙️ **Giọng đọc** | 30 giọng Gemini dựng sẵn (online) và **VieNeu-TTS** (chạy trên máy, miễn phí, tiếng Việt có phân vùng miền) - engine duy nhất **nhân bản được giọng của bạn** từ một đoạn ghi âm ngắn. |
| 🎨 **Style Design** | Bộ nhận diện thương hiệu (màu, font, logo, tone, hiệu ứng) cưỡng chế 100% lên mọi sản phẩm. Gõ tên font là tự tải từ Google Fonts, đủ dấu tiếng Việt. Style có logo thì tự đóng logo góc trên trái. |
| 🧩 **Phong cách dựng** | 50 ngôn ngữ thị giác dựng sẵn cho riêng từng video - gấp giấy, mực tàu, sơn mài, chữ động, neo-brutalism, đất sét, film noir... Sửa được và thêm được phong cách của bạn. Mặc định tắt. |
| 🖼️ **Ảnh AI & ảnh minh họa** | Gemini (API key) hoặc gateway tùy chọn dùng tài khoản web ChatGPT / Gemini vẽ nền và ảnh minh họa đồng bộ style; Remotion đặt toàn bộ chữ lên trên nên chữ tiếng Việt không bao giờ sai chính tả. |
| 🔑 **Bố cục Key** | Key chính nằm band trên, key liên quan nằm band dưới, chạy theo nội dung đang nói. |
| 📝 **Phụ đề karaoke tiếng Việt** | faster-whisper word-timestamp (ưu tiên GPU), highlight keyword, các fix mất dấu đã kiểm chứng. |
| 🎨 **Chỉnh màu có preview** | 14 preset + chỉnh tay, xem trước từng frame; footage log/HDR tự tonemap. |
| 🔊 **Sound effects & nhạc nền** | 86 sound effect đi kèm cùng bộ đề xuất AI ưu tiên dùng; thư viện nhạc của riêng bạn gắn tag mood, tự hạ âm lượng khi có thoại. |
| 🏷️ **Logo thương hiệu** | Repo kèm sẵn 125 logo; kịch bản nhắc brand nào chưa có thì tự tải về (Simple Icons, rồi Wikidata) - logo không bao giờ do AI tự vẽ. |
| 🧠 **Skills** | Know-how sản xuất dạng markdown, quản lý trên web UI, có cả **tạo skill bằng AI** từ form câu hỏi. |
| 🩺 **Kiểm tra & tự cài môi trường** | Một lệnh dò đủ FFmpeg, Chrome, xác thực Claude, Python, faster-whisper, khóa Gemini; thiếu gì cài giúp nấy. Có cả card cài một chạm trong Cấu hình. |
| ⚡ **Tăng tốc phần cứng** | Tự phát hiện GPU (NVENC trên NVIDIA, VideoToolbox trên macOS), render song song, `--gl angle`. Xem [Khi nào dùng CPU, khi nào dùng GPU](#khi-nào-dùng-cpu-khi-nào-dùng-gpu). |
| 🔄 **Cập nhật một chạm** | Badge cuối sidebar báo khi có bản phát hành mới; bấm một lần là kéo về, build lại và khởi động lại. |
| 📊 **Dashboard** | Tiến trình realtime (SSE), render queue, token AI theo ngày và loại project, phiên AI tự chạy tiếp khi gián đoạn. |

## Kiến trúc

```
┌─────────────────────────────────────────────────────┐
│  Web UI (Next.js, port 6868)                        │
│  Dashboard · Videos/Images Project · Auto cut ·     │
│  Text to video · Dịch video · Giọng đọc ·           │
│  Style Design · Phong cách dựng · Render Queue ·    │
│  Assets · Sound Effects · Prompts · Skills ·        │
│  Cấu hình · Kết nối  (+ trình chỉnh sửa, hướng dẫn) │
└──────────────────────┬──────────────────────────────┘
                       │ REST + SSE
┌──────────────────────┴──────────────────────────────┐
│  Backend (Express, port 6869)                       │
│  Claude Agent SDK · Render queue · SQLite           │
└──────┬──────────────────────────────┬───────────────┘
┌──────┴───────────┐        ┌─────────┴────────────┐
│ HyperFrames      │  MP4   │ Remotion             │
│ SCENE ENGINE     │───────▶│ ASSEMBLER            │
│ HTML + GSAP      │        │ scene + audio + sub  │
└──────────────────┘        └──────────────────────┘
```

`meta.json` của từng project là nguồn sự thật duy nhất - trình chỉnh sửa, AI và render queue đều đọc và ghi vào đó. Hợp đồng API đầy đủ: [`docs/API.md`](docs/API.md). Quy trình sản xuất + know-how: [`.claude/skills/`](.claude/skills/).

## Yêu cầu

- **Node.js 24 LTS** (hoặc 22.23.4+ / 26.12.1+ - bản vá bảo mật tháng 10/2026; HyperFrames yêu cầu `>=22`)
- **FFmpeg** trên PATH (macOS: `brew install ffmpeg`)
- **Google Chrome** (HyperFrames và Remotion render qua headless Chromium)
- **Claude**: đăng nhập [Claude Code](https://claude.com/claude-code) trên máy (subscription OAuth - khuyên dùng) *hoặc* điền `ANTHROPIC_API_KEY` vào `.env`
- **Gemini** (tạo ảnh, Gemini TTS, dịch): `GEMINI_API_KEY` trong `.env` - lấy tại [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Python 3.11 - 3.14** (tùy chọn) cho phụ đề (faster-whisper) và giọng đọc offline (VieNeu-TTS); gateway tạo ảnh tùy chọn cần **3.13 hoặc 3.14**. Python 3.15 quá mới - nhiều gói chưa có bản cho nó. Trên macOS cài bằng `brew install python@3.13` (Python 3.9 có sẵn của macOS quá cũ, còn `brew install python` có thể ra bản 3.15).
- Tùy chọn: GPU NVIDIA (NVENC) hoặc Mac Apple Silicon (VideoToolbox) để render nhanh hơn

Không phải tự cài tay từng thứ. Script khởi động kiểm tra hết danh sách trên và cài giúp những thứ cài được - xem [Kiểm tra môi trường](#kiểm-tra-môi-trường).

## Chạy

```bash
git clone https://github.com/notivn/AIEVv2.git
cd AIEVv2
```

**Windows** - nhấp đúp `start\start.bat` (hoặc chạy `start\start.ps1`).

**macOS** - nhấp đúp `start/start.command` trong Finder. File `.sh` KHÔNG nhấp đúp được trên macOS, nó chỉ mở bằng trình soạn thảo. Lần đầu macOS chặn "unidentified developer" thì chuột phải vào file → **Open** → **Open**.

**Linux** - chạy `./start/start.sh`.

Tải bản ZIP (thay vì `git clone`) thì lần đầu cấp quyền chạy cho script:

```bash
chmod +x start/*.sh start/*.command update/*.sh update/*.command
```

| Việc | Windows | macOS | Linux |
|---|---|---|---|
| Chạy hệ thống | `start\start.bat` | `start/start.command` | `./start/start.sh` |
| Dừng hệ thống | `start\stop.bat` | `start/stop.command` | `./start/stop.sh` |
| Cập nhật thủ công | `update\update.bat` | `update/update.command` | `bash update/update.sh` |
| Mở tunnel (upload từ điện thoại) | `start\tunnel.bat` | `start/tunnel.command` | `./start/tunnel.sh` |

Script tự lo mọi thứ: kiểm tra môi trường → `npm install` (lần đầu) → build → tạo `.env` → chạy server + web → mở `http://localhost:6868`.

Chạy dev thủ công: `npm install` rồi `npm run dev`.

### Cập nhật

Bấm badge cập nhật ở cuối sidebar - hệ thống kéo bản mới về, cài lại, build lại và khởi động lại. **Cấu hình → Kênh cập nhật** quyết định thế nào là "mới": **Bản chính thức (release)** (mặc định) chỉ nhận bản đã phát hành, **Bản mới nhất (main)** nhận mọi commit trên `main`. Cập nhật không đụng tới project, video đã xuất, Style Design và giọng nhân bản của bạn.

## Hướng dẫn sử dụng

Hướng dẫn đầy đủ và luôn đúng phiên bản nằm **ngay trong app**: bấm **Hướng dẫn** trên thanh trên cùng ở bất kỳ trang nào. Bảng mở đúng mục của trang đó, còn menu ở đầu bảng liệt kê mọi mục - bắt đầu, từng công cụ, các thư viện, các trang hệ thống và xử lý sự cố. Tóm tắt nhanh:

### Video đầu tiên (Videos Project)

1. **Tạo project** - **Videos Project** → **Tạo project**: đặt tên, chọn khung hình (9:16 cho TikTok/Reels, 16:9 cho YouTube) và fps.
2. **Đưa nguồn vào** - upload clip trong card **Nguồn & Asset**, hoặc bấm **Kết nối điện thoại** rồi quét QR để gửi file thẳng từ điện thoại.
3. **Điền Kịch bản edit** - tờ chỉ đạo cho AI: mô tả nguồn, tự động cắt ngắn, phụ đề karaoke kèm highlight keyword, bố cục Key, ảnh minh họa AI, sound effect và nhạc nền, Style Design, phong cách dựng, skill (format dựng) và ghi chú tự do. Mọi công tắc đều là thật: tắt tính năng nào thì AI được dặn không dùng tính năng đó.
4. **Bắt đầu edit bằng AI** - Claude transcribe, lên kế hoạch, dựng scene HyperFrames, sinh ảnh minh họa, đi sound effect rồi lắp thành bản **draft**. Tiến trình chạy realtime; mọi render đều qua **Render Queue**.
5. **Duyệt và hoàn thiện** - xem draft, góp ý qua chat ("phóng to hook lên", "cắt bớt intro"), tinh chỉnh trong **trình chỉnh sửa video**, rồi chạy **QC** và **render final**. File MP4 nằm trong `outputs/`, kèm thumbnail tự tạo và bộ publish (tiêu đề, mô tả, hashtag).

### Các công cụ khác

- **Images Project** - poster và thumbnail: model ảnh chỉ vẽ nền, Remotion đặt tiêu đề, số liệu, CTA và logo theo Style Design.
- **Auto cut videos** - lên kế hoạch các đoạn của video dài, tick đoạn muốn lấy, cắt thành các project con.
- **Text to video** - trích bài → kịch bản → giọng đọc → dựng, duyệt được từng bước.
- **Dịch video** - upload, lấy lời thoại, dịch, rồi phụ đề, lồng tiếng hoặc cả hai.
- **Giọng đọc** - nghe thử giọng dựng sẵn, cài VieNeu-TTS, nhân bản giọng của bạn.
- **Style Design / Phong cách dựng** - nhận diện thương hiệu (màu, font, logo) khác với ngôn ngữ thị giác của một video (chất liệu và chuyển động). Hai lớp chồng lên nhau, không thay thế nhau.
- **Sound Effects, Assets, Prompts, Skills** - các thư viện dùng chung mà AI lấy ra dùng.
- **Cấu hình / Kết nối** - kiểm tra hệ thống, GPU và hàng đợi, QC, kênh cập nhật; tài khoản Claude, Gemini và gateway ảnh.

## Khi nào dùng CPU, khi nào dùng GPU

Làm xong một video phải đi qua nhiều bước, mỗi bước chọn bộ xử lý khác nhau. Mặc định giữ **bản draft nhanh, bản final chất lượng**; mọi công tắc đều nằm trong **Cấu hình**.

| Bước | Chạy bằng | Công tắc |
|---|---|---|
| Dựng hình scene HyperFrames (Chrome ẩn) | **GPU** mặc định, tắt đi thì CPU | `GPU cho capture (browser)` -> `--browser-gpu` |
| Encode scene bản **draft** | **GPU** mặc định (NVENC / VideoToolbox) | `Encode GPU cho bản draft` -> `--gpu` |
| Encode scene bản **final** | **CPU** mặc định (libx264) | `Encode GPU cho bản FINAL`, mặc định TẮT |
| Dựng hình timeline Remotion | **GPU** mặc định, tắt đi thì CPU | `GPU cho capture (browser)` -> `--gl angle` (Linux: `angle-egl`) |
| Encode video lắp ráp (cả draft lẫn final) | **Luôn CPU** (libx264) | không chỉnh được; draft thêm `--crf 28 --x264-preset veryfast` |
| Auto cut: cắt + đổi khung từng đoạn | **GPU** chỉ khi bật `Encode GPU cho bản FINAL` **và** máy có NVENC, còn lại CPU | `Encode GPU cho bản FINAL` |
| Tạo lời thoại (faster-whisper large-v3) | **GPU** (CUDA, float16), lỗi thì rơi về **CPU** (int8) | tự động |
| QC tự động | **CPU** (ffmpeg chỉ đo) | - |
| Thumbnail (`remotion still`) | **GPU** mặc định, chung công tắc với capture | `GPU cho capture (browser)` |
| Ảnh Gemini, dò chủ thể, Claude edit | **Không dùng máy** - chạy trên server nhà cung cấp | - |

- **Encode bản final cố ý để CPU.** NVENC nhanh hơn nhiều nhưng cùng dung lượng file thì libx264 cho hình nhỉnh hơn. Muốn đổi chất lượng lấy tốc độ thì bật `Encode GPU cho bản FINAL`.
- **Phần encode của Remotion không bao giờ dùng GPU ở đây**, chỉ khâu dựng hình mới dùng. Không có `--gl angle` thì Remotion rơi về SwANGLE - dựng hình bằng phần mềm, chậm thấy rõ.
- **NVENC nhận diện qua `nvidia-smi`.** Nếu lỗi, hết session hoặc từ chối kích thước khung, job tự chạy lại bằng libx264 chứ không fail. Trên macOS khâu đổi khung của Auto cut luôn dùng libx264; HyperFrames trên máy đó vẫn dùng VideoToolbox.

Chạy song song là chuyện riêng: `Job render đồng thời (queue)` (mặc định 2) quyết định mấy job chạy cùng lúc, `Worker Chrome (HyperFrames)` là số luồng của HyperFrames, `Remotion concurrency` là số frame Remotion dựng song song. Hai job của **cùng một project** không bao giờ chạy đồng thời.

## Kiểm tra môi trường

`start/doctor.mjs` dò đủ những thứ pipeline cần - Node.js, FFmpeg, Google Chrome, xác thực Claude, Python và venv, faster-whisper, VieNeu-TTS, khóa Gemini, cloudflared, GPU - và cài giúp phần cài được:

| | |
|---|---|
| **Cài giúp bạn** (hỏi `[Y/n]` trước) | FFmpeg, Google Chrome, Claude Code, venv Python kèm faster-whisper, cloudflared - qua `winget` trên Windows, `brew` trên macOS, `npm`/`pip` cho phần còn lại |
| **Bạn tự làm, hệ thống chỉ đúng việc cần làm** | cài Node.js hoặc một bản Python phù hợp, đăng nhập Claude (`claude` → `/login`), dán khóa Gemini |

Nó chạy sẵn trong các script khởi động, và đúng danh sách đó hiện thành card **Kiểm tra hệ thống** trong **Cấu hình** - mỗi mục thiếu có nút cài một chạm (hoặc lệnh chép một phát nếu không tự cài được). Thiếu đồ **không chặn khởi động**: dashboard vẫn lên để bạn sửa ngay trên giao diện. Venv dựng bằng Python không hợp (quá cũ hoặc quá mới) sẽ tự dựng lại khi máy có bản Python phù hợp.

```bash
node start/doctor.mjs              # chỉ xem
node start/doctor.mjs --fix        # thiếu gì hỏi cài nấy
node start/doctor.mjs --fix --yes  # cài luôn, không hỏi
node start/doctor.mjs --lang en    # in tiếng Anh
```

### Dùng chung đồ đã cài giữa nhiều bản clone

Mọi thứ nặng dự án tự cài/tải về (venv Python với torch, VieNeu, faster-whisper; model vài GB; ffmpeg/cloudflared tải riêng; tài khoản gateway ảnh) nằm trong `.runtime/` **của từng thư mục repo** - nên clone sang chỗ khác là phải tải lại từ đầu. Muốn các bản clone dùng chung, thêm vào `.env` của MỖI bản:

```bash
AIEV_RUNTIME_DIR=D:\aiev-runtime        # đường dẫn tuyệt đối, hoặc tương đối tính từ gốc repo
```

- **Đơn giản nhất:** trỏ thẳng vào `.runtime` của bản đang chạy, vd `AIEV_RUNTIME_DIR=F:\vibe-coding\AIEV-v2\.runtime`. Không di chuyển gì nên venv còn nguyên - chỉ nhớ đừng xóa bản cũ.
- **Muốn một chỗ riêng:** chuyển `.runtime/` sang chỗ mới nhưng **xóa** hai thư mục `venv` và `venv-gateway` trong đó (venv ghi cứng đường dẫn tuyệt đối, chuyển đi là hỏng ngầm). Chạy start một lần, doctor dựng lại venv ngay tại chỗ mới. Model giữ nguyên, không tải lại.

Không chạy hai bản cùng lúc trên cùng một runtime. Giọng nhân bản nằm ở `assets/voices/` (không vào git) - chép tay sang bản mới.

## Upload từ điện thoại

Trong trang project, ở card **Nguồn & Asset** bấm **Kết nối điện thoại** rồi quét mã QR bằng điện thoại (cùng WiFi với máy chạy hệ thống) để mở `http://<ip-máy>:6868/m/<project>`. Video/ảnh chọn trên điện thoại tải thẳng vào project. Lần đầu Windows hỏi firewall thì chọn **Allow** (script start tự thêm rule nếu có quyền admin).

**Dùng từ xa qua 4G/5G:**
- **Cloudflare Tunnel** - điền `TUNNEL_DOMAIN=<domain-của-bạn>` (vd `aiev.noti.vn`) vào `.env`, QR Kết nối điện thoại sẽ dùng `https://<domain>/m/<project>`.
- Bật tunnel bằng script tunnel của hệ điều hành (bảng ở trên). Chưa điền `TUNNEL_DOMAIN` thì script chạy quick tunnel với URL ngẫu nhiên `trycloudflare.com`.
- ⚠️ **Cảnh báo**: dashboard chưa có đăng nhập - chỉ mở public khi đã bọc Cloudflare Access, và tuyệt đối không chia sẻ link.

## Cấu trúc thư mục

```
├── apps/web/            # Next.js dashboard (port 6868) - gồm cả hướng dẫn trong app (src/lib/guide)
├── apps/server/         # Express backend: Agent SDK + render queue + SQLite (port 6869)
├── engines/remotion/    # Remotion: composition Assemble (video) + Poster (ảnh)
├── .claude/skills/      # Skills - know-how sản xuất, quản lý được từ web UI
├── gateways/            # Gateway tạo ảnh tùy chọn (ChatGPT web, Gemini web) - AGPL, xem Giấy phép
├── assets/
│   ├── styles/          # Style Design (styles.json + font/logo) - ship rỗng
│   ├── video-styles/    # Phong cách dựng (video-styles.json, 50 phong cách dựng sẵn)
│   ├── sound-effects/   # Thư viện sound effect + library.json
│   ├── music/           # Thư viện nhạc nền - ship rỗng
│   ├── brand-logos/     # Logo thương hiệu + library.json, tự lớn dần
│   ├── prompts/         # Prompt mẫu
│   └── voices/          # Giọng nhân bản (không commit)
├── video-projects/      # Mỗi video một folder (không commit)
├── image-projects/      # Project tạo ảnh (không commit)
├── auto-cut/ · text-to-video/ · translate-video/   # Phiên của các công cụ đó (không commit)
├── outputs/             # Video final (không commit)
├── start/               # Script chạy/dừng/tunnel + doctor.mjs (Windows .bat/.ps1, macOS .command, Linux .sh)
├── update/              # Script cập nhật mà nút cập nhật gọi
└── docs/API.md          # Hợp đồng API - nguồn sự thật duy nhất
```

## Tech stack

Next.js 16 · React 19 · Tailwind 4 · Express 5 · better-sqlite3 · [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk) · [HyperFrames](https://www.npmjs.com/package/hyperframes) · [Remotion](https://remotion.dev) · Gemini API · faster-whisper · VieNeu-TTS · FFmpeg

## Đóng góp

Rất hoan nghênh báo lỗi, bản vá và skill mới. Đọc [CONTRIBUTING.vi.md](CONTRIBUTING.vi.md) trước - trong đó có cách chạy dự án, hai lệnh CI chạy trên mọi PR (`npm run typecheck` và `npm run build`), và các quy ước của codebase này. Việc lớn hơn một sửa nhỏ thì mở issue trước khi bắt tay làm.

Phát hiện lỗ hổng bảo mật? Đừng mở issue công khai, làm theo [SECURITY.md](SECURITY.md).

## Giấy phép

[MIT](LICENSE) - tự do dùng, sửa và phân phối, kể cả cho mục đích thương mại.

> Lưu ý về phụ thuộc: dự án này cấp phép MIT, nhưng các công cụ đi kèm giữ giấy phép riêng.
> Remotion miễn phí cho cá nhân và công ty tối đa 3 người; vượt mức đó cần
> [Company License](https://remotion.pro) - và trình chỉnh sửa video có nhúng Remotion Player, phần mà
> Remotion cấp phép theo gói "Automators" cho các công ty đó. Chi phí Claude và Gemini tính vào tài khoản của bạn.
>
> **Ngoại lệ - thư mục `gateways/`.** Hai gateway tạo ảnh tùy chọn **không phải MIT**: `gateways/chatgpt/`
> (vendored [chatgpt2api](https://github.com/yukkcat/chatgpt2api)) và `gateways/gemini-web/` (dựa trên
> [gemini-webapi](https://github.com/HanaokaYuzu/Gemini-API)) theo **AGPL-3.0**, mỗi thư mục có `LICENSE` riêng.
> Chúng chạy thành tiến trình riêng (sidecar chỉ nghe 127.0.0.1 và một worker stdin/stdout) bằng venv riêng
> `.runtime/venv-gateway`, chỉ được cài khi bạn chủ động bật (Kết nối → gateway tạo ảnh).
> `gateways/gemini-watermark-remover/` là MIT. Dùng tài khoản ChatGPT / Google qua chúng phải tuân theo điều
> khoản của các dịch vụ đó - đó là lựa chọn của bạn.

### Asset: repo ship code, không ship media

Giấy phép MIT ở trên áp cho **code**. Media thì mỗi thứ một giấy phép, nên repo cố ý kèm càng ít càng tốt:

| Thư mục | Repo có kèm? | Giấy phép |
|---|---|---|
| [`assets/sound-effects/`](assets/sound-effects/README.md) | Có, 86 file | **Sưu tầm nhiều nguồn, không rõ giấy phép - đừng dùng cho video thương mại** |
| [`assets/music/`](assets/music/README.md) | Không - ship rỗng | Của nguồn bạn lấy |
| [`assets/styles/`](assets/styles/README.md) | Không - ship rỗng | Style, font và logo là của bạn |
| [`assets/brand-logos/`](assets/brand-logos/README.md) | Có, 125 logo | **Nhãn hiệu của chủ thương hiệu**, KHÔNG thuộc MIT |
| Tên và logo **noti.vn** trên dashboard | Có | **Nhãn hiệu của noti.vn**, KHÔNG thuộc MIT |

**Sound effect đi kèm nhưng có điều kiện.** Bộ 86 file này là đồ sưu tầm nhiều năm từ nhiều nguồn, không ghi lại giấy phép của từng file. Nó có mặt để cài xong là dùng được ngay, nhưng **không dùng cho video thương mại** - không ai chứng minh được quyền với chúng. Làm thương mại thì thay dần bằng nguồn CC0 hoặc đã mua giấy phép, và ghi `source` + `license` cho từng file. Một số trích đoạn nhận ra ngay là của ai (jingle Netflix, nhạc Nintendo, SpongeBob…) thì không đi kèm repo, dù danh mục vẫn còn tên.

Nhạc nền thì ship rỗng hẳn: một bài nhạc dài vài phút rủi ro hơn một tiếng whoosh nửa giây rất nhiều. Font thì có sẵn lối đi: gõ tên font trong **Style Design** là hệ thống tự tải từ Google Fonts về máy bạn.

Style Design ship rỗng vì đó là nhận diện thương hiệu của riêng bạn - repo mang sẵn style của người khác thì ai clone về cũng dựng video bằng màu của họ, đóng logo của họ. Lần đầu vào trang Style Design, tạo style của bạn - nó tự thành mặc định.

Fork dự án này thì nhớ thay logo và tên noti.vn bằng của bạn: thay PNG trong `apps/web/public/brand/` rồi chạy `node apps/web/scripts/build-brand.mjs`.

---

Made with ❤️ by **noti.vn** - Claude điều khiển, con người duyệt.
