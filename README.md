# AIEV - AI Edit Video by [noti.vn](https://noti.vn)

[![CI](https://github.com/notivn/AIEVv2/actions/workflows/ci.yml/badge.svg)](https://github.com/notivn/AIEVv2/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-informational.svg)](LICENSE)

🇬🇧 English · [🇻🇳 Tiếng Việt](README.vi.md)

> **Automatic AI video editing.** Claude acts as the director - driving **HyperFrames** (motion-graphics scenes built with HTML + GSAP) and **Remotion** (timeline assembly) - while you supervise everything through the web dashboard at `http://localhost:6868`.

Drop in a clip, briefly describe what you want, click **"Start editing with AI"** - the system transcribes, writes the editing plan, builds kinetic-typography scenes, karaoke subtitles, beat-synced zooms and timestamped sound effects, assembles the timeline and exports an MP4. The same engine also turns articles into narrated videos, cuts long videos into shorts and translates videos into other languages.

Every page of the dashboard has a **Guide** button in the top bar: it opens a side panel on the guide for the page you are on, with a menu to read any other section.

## Features

| | |
|---|---|
| 🎬 **AI video editing** | Claude analyzes the source → builds HyperFrames scenes → assembles with Remotion → MP4. Draft first, final later, every frame verified. |
| 🎞️ **Video editor** | Preview the edit in the browser (the real Remotion composition, no render needed) and change it on a timeline: reorder/trim/split scenes, edit karaoke words, subtitles, highlight cards, sound effects and music - or tell the AI in the side chat. Track locks, version history, export to Premiere Pro / DaVinci Resolve (XML). |
| 📰 **Text to video** | Paste a URL or text → the AI writes a spoken script in chunks → narration with Gemini TTS or on-device VieNeu-TTS → a video project edited by the AI. |
| ✂️ **Auto cut** | One long talking-head video → many shorts, split by time, by AI-picked highlights or by your prompt. Each segment becomes its own project sharing one brief. |
| 🌐 **Translate video** | Pulls the dialogue, translates it into the language you pick, then burns translated subtitles, dubs a new voice track, or both. |
| 🎙️ **Voices** | 30 Gemini preset voices (online) and **VieNeu-TTS** (offline, free, Vietnamese with regional accents) - the only engine that can **clone your own voice** from a short recording. |
| 🎨 **Style Design** | Brand kits (colors, fonts, logo, tone, effects) enforced 100% on every output. Type a font name and it downloads from Google Fonts with full Vietnamese diacritics. A style with a logo is stamped top-left automatically. |
| 🧩 **Edit styles** | 50 built-in visual languages for a single video - paper craft, ink wash, Vietnamese lacquer, kinetic typography, neo-brutalism, claymation, film noir... Editable, and you can add your own. Off by default. |
| 🖼️ **AI images & illustrations** | Gemini (API key) or the optional ChatGPT / Gemini web-account gateways paint backgrounds and style-matched illustrations; Remotion places every word on top, so Vietnamese text is never misspelled. |
| 🔑 **Key layout** | The main key sits in the top band, related keys in the bottom band, synced to what is being said. |
| 📝 **Vietnamese karaoke subtitles** | faster-whisper word timestamps (GPU preferred), keyword highlighting, battle-tested fixes for missing diacritics. |
| 🎨 **Color grading with preview** | 14 presets + manual adjustments, per-frame preview; log/HDR footage is tonemapped automatically. |
| 🔊 **Sound effects & music** | 86 bundled sound effects with a curated set the AI reaches for first; your own music library with mood tags and auto-ducking under speech. |
| 🏷️ **Brand logos** | 125 brand logos ship with the repo; a brand the script mentions that is missing is downloaded automatically (Simple Icons, then Wikidata) - logos are never drawn by AI. |
| 🧠 **Skills** | Production know-how as markdown, managed in the web UI, including **AI-generated skills** from a question form. |
| 🩺 **Environment check & auto-install** | One command probes FFmpeg, Chrome, Claude credentials, Python, faster-whisper and the Gemini key, then installs what it can. Also a card with one-click installs in Settings. |
| ⚡ **Hardware acceleration** | Auto-detects the GPU (NVENC on NVIDIA, VideoToolbox on macOS), parallel rendering, `--gl angle`. See [CPU or GPU, step by step](#cpu-or-gpu-step-by-step). |
| 🔄 **One-click updates** | The badge at the bottom of the sidebar shows when a new release is out; one click pulls, rebuilds and restarts. |
| 📊 **Dashboard** | Realtime progress (SSE), render queue, AI tokens by day and project type, AI sessions auto-resume after interruptions. |

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Web UI (Next.js, port 6868)                        │
│  Dashboard · Videos/Images Project · Auto cut ·     │
│  Text to video · Translate video · Voices ·         │
│  Style Design · Edit styles · Render Queue ·        │
│  Assets · Sound Effects · Prompts · Skills ·        │
│  Settings · Connections  (+ video editor, guide)    │
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

Each project's `meta.json` is the single source of truth - the editor, the AI and the render queue all read and write it. Full API contract: [`docs/API.md`](docs/API.md). Production workflow + know-how: [`.claude/skills/`](.claude/skills/).

## Requirements

- **Node.js 24 LTS** (or 22.23.4+ / 26.12.1+ - the October 2026 security releases; HyperFrames needs `>=22`)
- **FFmpeg** on PATH (macOS: `brew install ffmpeg`)
- **Google Chrome** (HyperFrames and Remotion render through headless Chromium)
- **Claude**: sign in to [Claude Code](https://claude.com/claude-code) on this machine (subscription OAuth - recommended) *or* put `ANTHROPIC_API_KEY` in `.env`
- **Gemini** (image generation, Gemini TTS, translation): `GEMINI_API_KEY` in `.env` - get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- **Python 3.11 - 3.14** (optional) for subtitles (faster-whisper) and offline voices (VieNeu-TTS); the optional image gateways need **3.13 or 3.14**. Python 3.15 is too new - several packages have no builds for it yet. On macOS install it with `brew install python@3.13` (the system Python 3.9 is too old, and plain `brew install python` may give you 3.15).
- Optional: an NVIDIA GPU (NVENC) or an Apple Silicon Mac (VideoToolbox) for faster rendering

You do not have to install these by hand. The start script checks every item above and offers to install whatever it can - see [Environment check](#environment-check).

## Getting started

```bash
git clone https://github.com/notivn/AIEVv2.git
cd AIEVv2
```

**Windows** - double-click `start\start.bat` (or run `start\start.ps1`).

**macOS** - double-click `start/start.command` in Finder. A `.sh` file cannot be double-clicked on macOS, it just opens in an editor. If macOS blocks it as coming from an unidentified developer, right-click the file → **Open** → **Open**.

**Linux** - run `./start/start.sh`.

If you downloaded a ZIP instead of cloning, make the scripts executable once:

```bash
chmod +x start/*.sh start/*.command update/*.sh update/*.command
```

| Task | Windows | macOS | Linux |
|---|---|---|---|
| Start | `start\start.bat` | `start/start.command` | `./start/start.sh` |
| Stop | `start\stop.bat` | `start/stop.command` | `./start/stop.sh` |
| Update manually | `update\update.bat` | `update/update.command` | `bash update/update.sh` |
| Open a tunnel (phone uploads) | `start\tunnel.bat` | `start/tunnel.command` | `./start/tunnel.sh` |

The script handles everything: checks the environment → `npm install` (first run) → build → creates `.env` → starts server + web → opens `http://localhost:6868`.

Manual dev run: `npm install` then `npm run dev`.

### Updating

Use the update badge at the bottom of the sidebar - it pulls the new version, reinstalls, rebuilds and restarts. **Settings → Update channel** decides what counts as new: **Stable (release)** (default) only offers published releases, **Latest (main)** takes every commit on `main`. Projects, outputs, styles and cloned voices are not touched by an update.

## User guide

The full, up-to-date guide lives **inside the app**: click **Guide** in the top bar on any page. It opens on the section for that page, and the menu at the top of the panel lists every section - getting started, each tool, the libraries and the system pages, plus troubleshooting. A short tour:

### Your first video (Videos Project)

1. **Create a project** - **Videos Project** → **Create project**: name, frame size (9:16 for TikTok/Reels, 16:9 for YouTube) and fps.
2. **Add the source** - upload your clip in the **Sources & Assets** card, or click **Connect phone** and scan the QR to send files straight from your phone.
3. **Fill in the brief** - the AI's instruction sheet: source description, auto-trim, karaoke subtitles with keyword highlighting, key layout, AI illustrations, sound effects and background music, Style Design, edit style, skill (editing format) and free-form notes. Every switch is real: turn a feature off and the AI is told not to use it.
4. **Start editing with AI** - Claude transcribes, plans, builds HyperFrames scenes, generates illustrations, wires sound effects and assembles a **draft**. Progress streams live; every render goes through the **Render Queue**.
5. **Review and finish** - watch the draft, ask for changes in the chat ("make the hook bigger", "cut the intro"), fine-tune in the **video editor**, then run **QC** and the **final render**. The MP4 lands in `outputs/` with an auto-generated thumbnail and a publish pack (title, description, hashtags).

### The other tools

- **Images Project** - posters and thumbnails: the image model paints the background only, Remotion overlays title, stats, CTA and logo per the Style Design.
- **Auto cut videos** - plan segments of a long video, tick the ones you want, cut them into child projects.
- **Text to video** - extract → script → voice → build, reviewing each stage.
- **Translate video** - upload, pull dialogue, translate, then subtitles, dubbing or both.
- **Voices** - preview preset voices, install VieNeu-TTS, clone your own voice.
- **Style Design / Edit styles** - brand identity (colors, fonts, logo) versus the visual language of one video (materials and motion). They stack; they never replace each other.
- **Sound Effects, Assets, Prompts, Skills** - the shared libraries the AI draws from.
- **Settings / Connections** - system check, GPU and queue settings, QC, update channel, image gateway; Claude, Gemini and gateway accounts.

## CPU or GPU, step by step

Making one video runs through several stages, and each one picks its processor differently. The defaults keep drafts fast and finals high quality; every switch is in **Settings**.

| Stage | Runs on | Controlled by |
|---|---|---|
| Rasterizing HyperFrames scenes (headless Chrome) | **GPU** by default, CPU if turned off | `GPU for capture (browser)` -> `--browser-gpu` |
| Encoding a scene **draft** | **GPU** by default (NVENC / VideoToolbox) | `GPU encode for drafts` -> `--gpu` |
| Encoding a scene **final** | **CPU** by default (libx264) | `GPU encode for FINAL`, off by default |
| Rasterizing the Remotion timeline | **GPU** by default, CPU if turned off | `GPU for capture (browser)` -> `--gl angle` (`angle-egl` on Linux) |
| Encoding the assembled video (draft + final) | **CPU always** (libx264) | not configurable; draft adds `--crf 28 --x264-preset veryfast` |
| Auto cut: cutting + reframing each segment | **GPU** only if `GPU encode for FINAL` is on **and** NVENC exists, otherwise CPU | `GPU encode for FINAL` |
| Transcription (faster-whisper large-v3) | **GPU** (CUDA, float16), falls back to **CPU** (int8) | automatic |
| Automated QC | **CPU** (ffmpeg only measures) | - |
| Thumbnail (`remotion still`) | **GPU** by default, same switch as capture | `GPU for capture (browser)` |
| Gemini images, subject detection, Claude editing | **Neither** - runs on the provider's servers | - |

- **Final encoding is deliberately on the CPU.** NVENC is much faster but at the same file size libx264 looks slightly better. Turn on `GPU encode for FINAL` if you prefer speed.
- **Remotion's own encoding never uses the GPU here**, only its rasterizing does. Without `--gl angle` Remotion falls back to SwANGLE, pure software rendering, which is noticeably slower.
- **NVENC is detected through `nvidia-smi`.** If it fails, runs out of sessions or rejects a frame size, the job re-runs on libx264 instead of failing. On macOS the auto-cut reframe always uses libx264; HyperFrames still uses VideoToolbox there.

Parallelism is separate: `Concurrent render jobs (queue)` (2 by default) sets how many jobs run at once, `Chrome workers (HyperFrames)` the HyperFrames worker count, `Remotion concurrency` how many frames Remotion renders in parallel. Two jobs of the **same project** never run at the same time.

## Environment check

`start/doctor.mjs` probes everything the pipeline needs - Node.js, FFmpeg, Google Chrome, Claude credentials, Python and its venv, faster-whisper, VieNeu-TTS, the Gemini key, cloudflared, GPU - and installs what it can:

| | |
|---|---|
| **Installed for you** (after a `[Y/n]` prompt) | FFmpeg, Google Chrome, Claude Code, the Python venv with faster-whisper, cloudflared - via `winget` on Windows, `brew` on macOS, `npm`/`pip` elsewhere |
| **You do it, we tell you exactly how** | installing Node.js or a suitable Python, signing in to Claude (`claude` → `/login`), pasting the Gemini key |

It runs automatically inside the start scripts, and the same list appears as the **System check** card in **Settings**, with a one-click install button per missing item (or a copyable command when it cannot be automated). Missing pieces never block startup - the dashboard comes up regardless so you can fix things from the UI. A venv built with an unsupported Python (too old or too new) is rebuilt automatically once a suitable Python is found.

```bash
node start/doctor.mjs              # just look
node start/doctor.mjs --fix        # ask before installing each missing item
node start/doctor.mjs --fix --yes  # install without asking
node start/doctor.mjs --lang en    # English output
```

### Sharing installed tools between several clones

Everything heavy the project installs or downloads (the Python venv with torch, VieNeu and faster-whisper; several GB of models; separately downloaded ffmpeg/cloudflared; image-gateway accounts) lives in `.runtime/` **of each repo folder**, so a fresh clone elsewhere downloads it all again. To share one copy, add this to the `.env` of EACH clone:

```bash
AIEV_RUNTIME_DIR=D:\aiev-runtime        # absolute, or relative to the repo root
```

- **Simplest:** point straight at the `.runtime` of the install you already run, e.g. `AIEV_RUNTIME_DIR=F:\vibe-coding\AIEV-v2\.runtime`. Nothing moves, so the venv keeps working - just do not delete the old install.
- **A neutral location:** move `.runtime/` there but **delete** its `venv` and `venv-gateway` folders (a venv records absolute paths and breaks silently when moved). Run start once and the environment check rebuilds them in the new place. The models stay put and are not downloaded again.

Do not run two clones at the same time on one runtime. Cloned voices live in `assets/voices/` (not in git) - copy that folder across by hand.

## Upload from your phone

On a project page, in the **Sources & Assets** card click **Connect phone** and scan the QR code with your phone (same Wi-Fi as the machine) to open `http://<machine-ip>:6868/m/<project>`. Videos and photos picked on the phone upload straight into the project. The first time Windows asks about the firewall, choose **Allow** (the start script adds the rule itself when it has admin rights).

**Remote over 4G/5G:**
- **Cloudflare Tunnel** - set `TUNNEL_DOMAIN=<your-domain>` (e.g. `aiev.noti.vn`) in `.env`, and the Connect phone QR uses `https://<domain>/m/<project>`.
- Start the tunnel with the tunnel script for your OS (table above). Without `TUNNEL_DOMAIN` it falls back to a quick tunnel with a random `trycloudflare.com` URL.
- ⚠️ **Warning**: the dashboard has no login - only expose it publicly behind Cloudflare Access, and never share the link.

## Folder structure

```
├── apps/web/            # Next.js dashboard (port 6868) - incl. the in-app guide (src/lib/guide)
├── apps/server/         # Express backend: Agent SDK + render queue + SQLite (port 6869)
├── engines/remotion/    # Remotion: Assemble (video) + Poster (image) compositions
├── .claude/skills/      # Skills - production know-how, manageable from the web UI
├── gateways/            # Optional image gateways (ChatGPT web, Gemini web) - AGPL, see License
├── assets/
│   ├── styles/          # Style Design (styles.json + fonts/logos) - ships empty
│   ├── video-styles/    # Edit styles (video-styles.json, 50 built in)
│   ├── sound-effects/   # Sound-effect library + library.json
│   ├── music/           # Background music library - ships empty
│   ├── brand-logos/     # Brand logos + library.json, grows automatically
│   ├── prompts/         # Prompt templates
│   └── voices/          # Cloned voices (not committed)
├── video-projects/      # One folder per video (not committed)
├── image-projects/      # Image projects (not committed)
├── auto-cut/ · text-to-video/ · translate-video/   # Sessions of those tools (not committed)
├── outputs/             # Final videos (not committed)
├── start/               # Start/stop/tunnel scripts + doctor.mjs (Windows .bat/.ps1, macOS .command, Linux .sh)
├── update/              # Update scripts used by the update button
└── docs/API.md          # API contract - the single source of truth
```

## Tech stack

Next.js 16 · React 19 · Tailwind 4 · Express 5 · better-sqlite3 · [Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk) · [HyperFrames](https://www.npmjs.com/package/hyperframes) · [Remotion](https://remotion.dev) · Gemini API · faster-whisper · VieNeu-TTS · FFmpeg

## Contributing

Bug reports, fixes and skills are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) first - it covers the setup, the two commands CI runs on every PR (`npm run typecheck` and `npm run build`), and the conventions this codebase follows. For anything larger than a small fix, open an issue before you build.

Found a security problem? Do not open a public issue - follow [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) - free to use, modify and distribute, including commercially.

> Note on dependencies: this project's own license is MIT, but bundled tools keep their own.
> Remotion in particular is free for individuals and companies of up to 3 people; beyond that you
> need a [Company License](https://remotion.pro) - and the video editor embeds the Remotion Player, which
> Remotion licenses under its "Automators" tier for such companies. Claude and Gemini usage is billed to your own account.
>
> **Exception - `gateways/`.** The optional image gateways are **not MIT**: `gateways/chatgpt/` (vendored
> [chatgpt2api](https://github.com/yukkcat/chatgpt2api)) and `gateways/gemini-web/` (built on
> [gemini-webapi](https://github.com/HanaokaYuzu/Gemini-API)) are **AGPL-3.0**, each with its own `LICENSE`.
> They run as separate processes (a local-only sidecar on 127.0.0.1 and a stdin/stdout worker) in their own
> venv `.runtime/venv-gateway`, installed only when you opt in (Connections → image gateway).
> `gateways/gemini-watermark-remover/` is MIT. Using a ChatGPT or Google account through them is subject to
> those services' terms - that is your call.

### Assets: this repo ships code, not media

The MIT license above covers the **code**. Media licensing varies per file, so the repo deliberately ships as little of it as possible:

| Folder | Bundled? | License |
|---|---|---|
| [`assets/sound-effects/`](assets/sound-effects/README.md) | Yes, 86 files | **Collected from assorted sources, licensing unknown - not for commercial video** |
| [`assets/music/`](assets/music/README.md) | No - ships empty | Whatever your source says |
| [`assets/styles/`](assets/styles/README.md) | No - ships empty | Your styles, fonts and logo are yours |
| [`assets/brand-logos/`](assets/brand-logos/README.md) | Yes, 125 logos | **Trademarks of their owners**, NOT covered by MIT |
| The **noti.vn** name and logo on the dashboard | Yes | **noti.vn trademark**, NOT covered by MIT |

**The sound effects ship with a condition.** Those 86 files were collected over years from assorted sources with no licensing records. They are here so the feature works out of the box, but **not for commercial video** - nobody can prove rights to them. For commercial work, replace them with CC0 or properly licensed audio and record `source` + `license` per file. Excerpts that are recognisably someone's property (the Netflix jingle, Nintendo sounds, SpongeBob…) are not included, even though the catalogue still lists their names.

Music ships empty outright: a multi-minute track is a far bigger risk than a half-second whoosh. Fonts have a built-in path instead: type a font name in **Style Design** and it downloads from Google Fonts onto your machine.

Style Design ships empty because a style is your own brand identity - a repo carrying someone else's style would have everyone building videos in their colours, watermarked with their logo. Create your first style on the Style Design page and it becomes the default.

If you fork this, replace the noti.vn name and logo with your own: swap the PNGs in `apps/web/public/brand/` and run `node apps/web/scripts/build-brand.mjs`.

---

Made with ❤️ by **noti.vn** - Claude directs, humans approve.
