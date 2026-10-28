import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { nanoid } from "nanoid";
import {
  briefOf,
  projectDirOf,
  readMeta,
  writeAssetEntry,
  writeMeta,
  SOURCE_TEXT_MAX,
} from "../meta.js";
import { probeDurationSec, transcribeVideo } from "../transcribe.js";
import { chunkForTts, synthScript } from "../tts.js";
import { ensureDir, HttpError } from "../util.js";

/**
 * Giọng đọc cho video không có footage (nguồn "Link bài viết" / "Yêu cầu" của
 * Video Project) - agent gọi sau khi viết xong kịch bản. Mount dưới /api/projects.
 *
 * - brief.narrationMode "tts": agent gửi KỊCH BẢN, server đọc bằng ĐÚNG giọng
 *   người dùng chọn trong brief (body không có trường giọng - agent không đổi được).
 * - brief.narrationMode "file": giọng thu sẵn `brief.narrationFile`, body rỗng.
 * Cả hai: whisper lấy mốc TỪNG TỪ (phụ đề karaoke + khớp scene bám vào đó, TTS
 * không trả mốc), gắn file vào meta.audio.voice.
 * - "none" (hoặc nguồn là video) → 409: công tắc tắt thì server chặn, không chỉ
 *   prompt dặn (CLAUDE.md 5.7).
 *
 * Chạy nền TRONG BỘ NHỚ như generate-image: VieNeu đọc chậm cỡ thời gian thật,
 * whisper thêm vài chục giây - agent poll GET tới khi xong. Mất task khi server
 * khởi động lại thì agent gọi lại.
 */

export const NARRATION_VOICE_REL = "assets/narration.wav";
export const NARRATION_TRANSCRIPT_REL = "assets/narration.transcript.json";

interface NarrationTask {
  id: string;
  projectId: string;
  status: "running" | "done" | "failed";
  step: "voicing" | "transcribing" | "done";
  progress: number;
  voice?: string;
  transcript?: string;
  durationSec?: number;
  error?: { code: string; message: string };
  finishedAt?: number;
}

const tasks = new Map<string, NarrationTask>();
const TASK_TTL_MS = 60 * 60 * 1000;

function prune(): void {
  const now = Date.now();
  for (const [id, t] of tasks) if (t.finishedAt && now - t.finishedAt > TASK_TTL_MS) tasks.delete(id);
}

const absOf = (id: string, rel: string): string => path.join(projectDirOf(id), ...rel.split("/"));

const router = Router();

// POST /api/projects/:id/narration {script?} → 202 {taskId, mode}
router.post("/:id/narration", (req, res) => {
  const id = req.params.id;
  const meta = readMeta(id); // 404 nếu không có
  const brief = briefOf(meta);
  if (brief.sourceKind === "video") {
    throw new HttpError(
      409,
      "NARRATION_NOT_APPLICABLE",
      "Nguồn của project là video tải lên - giọng nói nằm sẵn trong video, không tạo giọng đọc riêng.",
    );
  }
  if (brief.narrationMode === "none") {
    throw new HttpError(
      409,
      "NARRATION_DISABLED",
      "Người dùng TẮT lồng tiếng cho project này - dựng video không giọng đọc.",
    );
  }
  prune();
  if ([...tasks.values()].some((t) => t.projectId === id && t.status === "running")) {
    throw new HttpError(409, "NARRATION_BUSY", "Đang tạo giọng đọc cho project này - đợi lượt đang chạy xong.");
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  let chunks: string[] = [];
  let sourceAbs = "";
  if (brief.narrationMode === "tts") {
    const script = typeof body.script === "string" ? body.script.trim() : "";
    if (!script) throw new HttpError(400, "SCRIPT_REQUIRED", "Thiếu kịch bản đọc (script)");
    if (script.length > SOURCE_TEXT_MAX) {
      throw new HttpError(400, "SCRIPT_TOO_LONG", `Kịch bản đọc tối đa ${SOURCE_TEXT_MAX} ký tự`);
    }
    chunks = chunkForTts(script);
  } else {
    if (!brief.narrationFile) {
      throw new HttpError(409, "NARRATION_FILE_MISSING", "Chưa chọn file giọng thu sẵn ở cột Nguồn.");
    }
    sourceAbs = absOf(id, brief.narrationFile);
    if (!fs.existsSync(sourceAbs)) {
      throw new HttpError(404, "NARRATION_FILE_MISSING", `Không thấy file giọng "${brief.narrationFile}" trong project.`);
    }
  }

  const task: NarrationTask = { id: nanoid(12), projectId: id, status: "running", step: "voicing", progress: 0 };
  tasks.set(task.id, task);
  const log = (line: string) => console.log(`[narration] ${id}: ${line}`);

  void (async () => {
    try {
      let voiceRel = brief.narrationFile;
      let voiceAbs = sourceAbs;
      if (brief.narrationMode === "tts") {
        voiceRel = NARRATION_VOICE_REL;
        voiceAbs = absOf(id, voiceRel);
        const v = brief.narrationVoice;
        await synthScript({
          chunks,
          engine: v.engine,
          voice: v.name,
          model: v.model,
          style: v.style,
          language: v.language,
          speed: v.speed,
          // renders/ đã gitignore - các đoạn part-XXX.wav không lọt vào assets
          workDir: path.join(projectDirOf(id), "renders", "narration-work"),
          outWavAbs: voiceAbs,
          onProgress: (done, total) => {
            task.progress = Math.round((done / Math.max(1, total)) * 70);
          },
          onLog: log,
        });
        writeAssetEntry(id, path.basename(voiceAbs), {
          description: `Giọng đọc AI (${v.engine} · ${v.name}${v.speed !== 1 ? ` · x${v.speed}` : ""})`,
        });
      }

      task.step = "transcribing";
      task.progress = Math.max(task.progress, 72);
      const transcriptAbs = absOf(id, NARRATION_TRANSCRIPT_REL);
      ensureDir(path.dirname(transcriptAbs));
      const lang = brief.narrationMode === "tts" ? brief.narrationVoice.language.split("-")[0] || "vi" : "vi";
      await transcribeVideo({ videoAbs: voiceAbs, outJsonAbs: transcriptAbs, language: lang, onLog: log });
      writeAssetEntry(id, path.basename(transcriptAbs), {
        description: `Mốc thời gian từng từ của giọng đọc (${voiceRel})`,
      });

      // Đọc lại meta NGAY TRƯỚC khi ghi - đọc giọng mất vài phút, người dùng/agent có thể vừa sửa
      const fresh = readMeta(id);
      fresh.audio = { ...(fresh.audio ?? { voice: null, sfx: [] }), voice: voiceRel };
      writeMeta(id, fresh);

      task.voice = voiceRel;
      task.transcript = NARRATION_TRANSCRIPT_REL;
      task.durationSec = await probeDurationSec(voiceAbs).catch(() => undefined);
      task.status = "done";
      task.step = "done";
      task.progress = 100;
    } catch (err) {
      task.status = "failed";
      task.error = {
        code: err instanceof HttpError ? err.code : "NARRATION_FAILED",
        message: err instanceof Error ? err.message : String(err),
      };
      log(`${task.error.code} - ${task.error.message}`);
    } finally {
      task.finishedAt = Date.now();
    }
  })();

  res.status(202).json({ taskId: task.id, mode: brief.narrationMode });
});

// GET /api/projects/:id/narration/:taskId
router.get("/:id/narration/:taskId", (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task || task.projectId !== req.params.id) {
    throw new HttpError(404, "TASK_NOT_FOUND", "Không thấy tác vụ giọng đọc (quá 1 giờ hoặc server vừa khởi động lại) - gọi lại POST.");
  }
  const { id: _id, projectId: _p, finishedAt: _f, ...rest } = task;
  res.json(rest);
});

export default router;
