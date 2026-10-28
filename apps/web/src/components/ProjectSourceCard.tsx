"use client";

/**
 * Card "Nguồn video" ở cột Nguồn của trang project: video dựng từ đâu.
 *
 * - Video        = AI edit file người dùng tải lên (card asset ngay bên dưới) - mặc định.
 * - Link bài viết = server bóc bài NGAY khi bấm "Lấy bài" (thấy trước tiêu đề/độ
 *   dài, sửa link nếu trang chặn), lưu thành asset `assets/source-article.md`.
 * - Yêu cầu       = mô tả bằng chữ video muốn có (chủ đề, kịch bản, nội dung dán vào).
 *
 * Hai loại sau không có footage: AI dựng video motion graphics (chữ động, số liệu,
 * ảnh minh họa). Công tắc "Ảnh minh họa AI" hiện ngay tại đây vì đó là nguồn
 * hình ảnh chính của loại video này - nó là CÙNG một field brief.autoIllustrations
 * với khối Brief, không phải công tắc thứ hai.
 *
 * Hai loại không footage có thêm "Lồng tiếng": giọng AI (chọn CHÍNH XÁC giọng
 * bằng VoicePicker - agent chỉ gửi kịch bản, server đọc bằng giọng này) hoặc
 * file giọng thu sẵn (tải lên / chọn từ asset âm thanh của project).
 *
 * Mọi field đi qua `onPatch` (đường lưu brief có debounce của trang).
 */

import { Bot, FileAudio, FileText, Film, Link2, MessageSquareText, RefreshCw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Banner } from "@/components/Banner";
import { DEFAULT_BRIEF } from "@/components/BriefFields";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { CheckboxField, Field } from "@/components/Field";
import { Panel } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { VoicePicker } from "@/components/VoicePicker";
import {
  fetchSourceArticle,
  getSourceArticle,
  mediaUrl,
  uploadAsset,
  type Brief,
  type FileInfo,
  type NarrationMode,
  type SourceArticleSummary,
  type SourceKind,
  type TextToVideoVoice,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

const SOURCE_TEXT_MAX = 20_000;

/** "video-projects/<id>/assets/x.mp3" (relPath của FileInfo, tính từ gốc repo) → "assets/x.mp3" */
function projectRelOf(relPath: string): string | null {
  const norm = relPath.replace(/\\/g, "/");
  const i = norm.indexOf("/assets/");
  return i >= 0 ? norm.slice(i + 1) : norm.startsWith("assets/") ? norm : null;
}

export function ProjectSourceCard({
  projectId,
  brief,
  hasVideo,
  audioAssets,
  disabled,
  onPatch,
  onAssetsChanged,
}: {
  projectId: string;
  /** null = brief chưa tải */
  brief: Brief | null;
  /** Project đã có file video trong assets */
  hasVideo: boolean;
  /** File âm thanh trong assets - để chọn làm giọng thu sẵn */
  audioAssets: FileInfo[];
  /** AI đang chạy trên project - đổi nguồn lúc này là đổi dưới chân nó */
  disabled: boolean;
  onPatch: (p: Partial<Brief>) => void;
  /** Vừa lưu bản bóc bài vào assets - trang tải lại danh sách asset */
  onAssetsChanged: () => void;
}) {
  const { t, tf } = useT();
  const kind: SourceKind = brief?.sourceKind ?? "video";
  const [url, setUrl] = useState(brief?.sourceUrl ?? "");
  const [article, setArticle] = useState<SourceArticleSummary | null>(null);
  const [fetching, setFetching] = useState(false);
  const [problem, setProblem] = useState<{ message: string; detail?: string } | null>(null);

  // Brief tải xong sau lượt render đầu - đồng bộ ô link một lần theo giá trị đã lưu
  const savedUrl = brief?.sourceUrl ?? "";
  useEffect(() => {
    setUrl((cur) => cur || savedUrl);
  }, [savedUrl]);

  useEffect(() => {
    let alive = true;
    getSourceArticle(projectId)
      .then((r) => {
        if (alive) setArticle(r.article);
      })
      .catch(() => {
        // không đọc được bản bóc - ô link vẫn dùng được, bấm "Lấy bài" là có lại
      });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const fetchArticle = async () => {
    const link = url.trim();
    if (!link || fetching) return;
    setFetching(true);
    setProblem(null);
    try {
      const res = await fetchSourceArticle(projectId, link);
      setArticle(res.article);
      // Server đã ghi brief - đẩy cùng giá trị vào bản đang sửa để lượt lưu debounce
      // kế tiếp không ghi đè link cũ lên
      onPatch({ sourceKind: "article", sourceUrl: link });
      onAssetsChanged();
    } catch (err) {
      setProblem({
        message: t("source.article.error"),
        detail: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setFetching(false);
    }
  };

  // ---- lồng tiếng
  // VoicePicker gửi từng phần nhỏ, có khi hai phần liền nhau trước khi trang kịp
  // render lại - gộp vào bản mới nhất qua ref chứ không vào `brief` của lượt render cũ
  // Brief từ meta cũ có thể thiếu field - lùi về giọng mặc định, đừng để undefined lọt xuống VoicePicker
  const voice: TextToVideoVoice = brief?.narrationVoice ?? DEFAULT_BRIEF.narrationVoice;
  const voiceRef = useRef<TextToVideoVoice>(voice);
  voiceRef.current = voice;
  const patchVoice = (p: Partial<TextToVideoVoice>) => {
    const next = { ...voiceRef.current, ...p };
    voiceRef.current = next;
    onPatch({ narrationVoice: next });
  };
  const narration: NarrationMode = brief?.narrationMode ?? "none";
  const lastOnMode = useRef<Exclude<NarrationMode, "none">>("tts");
  if (narration !== "none") lastOnMode.current = narration;
  const [uploading, setUploading] = useState(false);
  const [uploadProblem, setUploadProblem] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioOptions = audioAssets
    .map((f) => ({ f, rel: projectRelOf(f.relPath) }))
    .filter((o): o is { f: FileInfo; rel: string } => o.rel !== null);
  const chosenAudio = audioOptions.find((o) => o.rel === brief?.narrationFile) ?? null;

  const uploadVoice = async (file: File) => {
    setUploading(true);
    setUploadProblem(null);
    try {
      const info = await uploadAsset(file, "project", projectId);
      const rel = projectRelOf(info.relPath);
      if (rel) onPatch({ narrationFile: rel });
      onAssetsChanged();
    } catch (err) {
      setUploadProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  };

  const text = brief?.sourceText ?? "";
  const tooLong = text.length > SOURCE_TEXT_MAX;
  const urlValid = url.trim() === "" || /^https?:\/\//i.test(url.trim());
  const locked = disabled || !brief;

  return (
    <Card title={t("source.title")}>
      <div className="flex flex-col gap-3">
        <Segmented<SourceKind>
          label={t("source.title")}
          value={kind}
          disabled={locked}
          onChange={(v) => onPatch({ sourceKind: v })}
          options={[
            { value: "video", label: <KindLabel icon={Film} text={t("source.kind.video")} /> },
            { value: "article", label: <KindLabel icon={Link2} text={t("source.kind.article")} /> },
            { value: "request", label: <KindLabel icon={MessageSquareText} text={t("source.kind.request")} /> },
          ]}
        />
        <p className="text-meta text-[var(--text-muted)]">{t(`source.hint.${kind}`)}</p>

        {kind === "video" && !hasVideo && <Banner tone="muted" message={t("source.video.empty")} />}

        {kind === "article" && (
          <>
            <Field
              label={t("source.article.url")}
              htmlFor="source-url"
              hint={t("source.article.url-hint")}
              error={urlValid ? null : t("source.article.url-invalid")}
            >
              <div className="flex gap-2">
                <input
                  id="source-url"
                  className="input min-w-0 flex-1"
                  type="url"
                  inputMode="url"
                  value={url}
                  disabled={locked || fetching}
                  placeholder="https://"
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void fetchArticle();
                    }
                  }}
                />
                <Button
                  variant="secondary"
                  disabled={locked || fetching || !url.trim() || !urlValid}
                  onClick={() => void fetchArticle()}
                >
                  <RefreshCw size={14} strokeWidth={2} />
                  {fetching ? t("source.article.fetching") : article ? t("source.article.refetch") : t("source.article.fetch")}
                </Button>
              </div>
            </Field>
            {fetching && <div className="progress-indeterminate" aria-hidden="true" />}
            {problem && <Banner tone="danger" message={problem.message} detail={problem.detail} />}
            {article && !fetching && (
              <Panel
                title={
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <FileText size={14} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{article.title || t("source.article.untitled")}</span>
                  </span>
                }
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-[var(--text-muted)]">{article.excerpt}…</p>
                  <p className="text-meta text-[var(--text-muted)] [overflow-wrap:anywhere]">
                    {tf("source.article.meta", { chars: article.chars.toLocaleString(), file: article.relPath })}
                  </p>
                </div>
              </Panel>
            )}
            {!article && !fetching && !problem && brief?.sourceUrl && (
              <Banner tone="muted" message={t("source.article.not-fetched")} />
            )}
          </>
        )}

        {kind === "request" && (
          <Field
            label={t("source.request.label")}
            htmlFor="source-text"
            hint={tf("source.request.hint", { n: SOURCE_TEXT_MAX.toLocaleString() })}
            error={tooLong ? tf("source.request.too-long", { n: SOURCE_TEXT_MAX.toLocaleString() }) : null}
          >
            <textarea
              id="source-text"
              className="input"
              rows={6}
              value={text}
              disabled={locked}
              placeholder={t("source.request.placeholder")}
              onChange={(e) => onPatch({ sourceText: e.target.value })}
            />
          </Field>
        )}

        {kind !== "video" && brief && (
          <CheckboxField
            id="source-illustrations"
            label={t("source.illustrations")}
            hint={t("source.illustrations-hint")}
            checked={brief.autoIllustrations}
            disabled={locked}
            onChange={(v) => onPatch({ autoIllustrations: v })}
          />
        )}

        {kind !== "video" && brief && (
          <CheckboxField
            id="source-narration"
            label={t("source.narration")}
            hint={t("source.narration-hint")}
            checked={narration !== "none"}
            disabled={locked}
            onChange={(v) => onPatch({ narrationMode: v ? lastOnMode.current : "none" })}
          />
        )}

        {kind !== "video" && brief && narration !== "none" && (
          <Panel title={t("source.narration.title")}>
            <div className="flex flex-col gap-3">
              <Segmented<Exclude<NarrationMode, "none">>
                label={t("source.narration.title")}
                value={narration}
                disabled={locked}
                onChange={(v) => onPatch({ narrationMode: v })}
                options={[
                  { value: "tts", label: <KindLabel icon={Bot} text={t("source.narration.tts")} /> },
                  { value: "file", label: <KindLabel icon={FileAudio} text={t("source.narration.file")} /> },
                ]}
              />
              <p className="text-meta text-[var(--text-muted)]">{t(`source.narration.hint-${narration}`)}</p>

              {narration === "tts" && (
                <VoicePicker value={voice} onChange={patchVoice} disabled={locked} />
              )}

              {narration === "file" && (
                <>
                  <Field label={t("source.narration.pick")} htmlFor="source-narration-file">
                    <div className="flex gap-2">
                      <select
                        id="source-narration-file"
                        className="input min-w-0 flex-1"
                        value={chosenAudio?.rel ?? ""}
                        disabled={locked || uploading}
                        onChange={(e) => onPatch({ narrationFile: e.target.value })}
                      >
                        <option value="">{t("source.narration.pick-none")}</option>
                        {audioOptions.map((o) => (
                          <option key={o.rel} value={o.rel}>
                            {o.rel.replace(/^assets\//, "")}
                          </option>
                        ))}
                      </select>
                      <Button
                        variant="secondary"
                        disabled={locked || uploading}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={14} strokeWidth={2} />
                        {uploading ? t("source.narration.uploading") : t("source.narration.upload")}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,.wav,.mp3,.m4a,.aac,.ogg,.flac"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          if (f) void uploadVoice(f);
                        }}
                      />
                    </div>
                  </Field>
                  {uploadProblem && (
                    <Banner tone="danger" message={t("source.narration.upload-error")} detail={uploadProblem} />
                  )}
                  {chosenAudio ? (
                    <audio
                      controls
                      preload="metadata"
                      className="w-full"
                      src={mediaUrl(chosenAudio.f.relPath) + "?v=" + encodeURIComponent(chosenAudio.f.mtime)}
                    />
                  ) : (
                    <Banner tone="muted" message={t("source.narration.no-file")} />
                  )}
                </>
              )}
            </div>
          </Panel>
        )}
      </div>
    </Card>
  );
}

function KindLabel({ icon: Icon, text }: { icon: typeof Film; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {text}
    </span>
  );
}
