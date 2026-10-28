"use client";

/**
 * Tab "AI" của thư viện: tạo ảnh / cảnh trám ngay trong trình chỉnh sửa
 * (docs/EDITOR-V2-PLAN.md §2.7, §4.4).
 *
 * - Server chạy nền trong bộ nhớ (không chiếm render queue) - gateway web có
 *   thể mất 30s tới 10 phút, nên ở đây chỉ hỏi tiến độ mỗi 2s và đếm giờ.
 * - Lượt đang chạy nằm ở biến MODULE (theo project), không ở state: đổi tab thư
 *   viện là component bị gỡ, quay lại vẫn thấy lượt đó chạy tiếp và vẫn chèn
 *   được ảnh khi xong.
 * - "Hủy" chỉ thôi chờ - server vẫn làm xong và ảnh vẫn vào thư viện project
 *   (assets/generated/), chỉ là không tự chèn lên timeline nữa.
 * - Đây là thao tác TAY nên không bị công tắc "Ảnh minh họa AI" chặn; server trả
 *   409 AGENT_BUSY khi AI đang chạy trên project.
 */

import { ImagePlus, Layers, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { CheckboxField, Field } from "@/components/Field";
import { LinkButton } from "@/components/LinkButton";
import {
  ApiError,
  generateProjectImage,
  getGenerateImageTask,
  getImageProviders,
  type ImageProviderId,
  type ImageProviderInfo,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

export type AiImagePurpose = "filler" | "layer";

const POLL_MS = 2000;
const PROMPT_MAX = 2000;

interface PendingTask {
  taskId: string;
  purpose: AiImagePurpose;
  startedAt: number;
  /** Lần hỏi tiến độ gần nhất lỗi mạng liên tiếp bao nhiêu lần */
  netFails: number;
}

/** projectId → lượt đang chờ (sống qua việc gỡ/gắn lại component) */
const pendingByProject = new Map<string, PendingTask>();

type Problem = { code: string; message: string; detail?: string };

/** Câu giải thích theo mã lỗi §4.3 - chuỗi server đi vào phần chi tiết. */
export function useAiImageErrorText(): (code: string) => string {
  const { t } = useT();
  return (code) => {
    switch (code) {
      case "AGENT_BUSY":
        return t("editor.ai.err-agent-busy");
      case "GATEWAY_NOT_INSTALLED":
        return t("editor.ai.err-not-installed");
      case "GATEWAY_UNAVAILABLE":
        return t("editor.ai.err-unavailable");
      case "GATEWAY_AUTH_FAILED":
        return t("editor.ai.err-auth");
      case "GATEWAY_RATE_LIMITED":
        return t("editor.ai.err-rate-limited");
      case "GATEWAY_TIMEOUT":
        return t("editor.ai.err-timeout");
      case "GATEWAY_FAILED":
        return t("editor.ai.err-failed");
      case "INVALID_SESSION":
      case "INVALID_COOKIE":
        return t("editor.ai.err-credentials");
      case "network":
        return t("editor.ai.err-network");
      case "lost":
        return t("editor.ai.err-lost");
      default:
        return t("editor.ai.err-generic");
    }
  };
}

/** Lỗi do cấu hình (token/cookie/gateway) - có nút sang trang Kết nối */
export const AI_IMAGE_CONFIG_ERRORS = new Set([
  "GATEWAY_NOT_INSTALLED",
  "GATEWAY_AUTH_FAILED",
  "INVALID_SESSION",
  "INVALID_COOKIE",
]);

function fmtElapsed(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, "0")}` : `${s}s`;
}

export function AiImagePanel({
  projectId,
  readOnly,
  onReady,
}: {
  projectId: string;
  readOnly: boolean;
  /** Ảnh đã nằm trong project - trang chèn scene trám / layer tại playhead */
  onReady: (r: { relPath: string; purpose: AiImagePurpose }) => void;
}) {
  const { t, tf } = useT();
  const errorText = useAiImageErrorText();
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState<string>("auto");
  const [allowText, setAllowText] = useState(false);
  const [providers, setProviders] = useState<ImageProviderInfo[] | null>(null);
  const [providersError, setProvidersError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTask | null>(() => pendingByProject.get(projectId) ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [problem, setProblem] = useState<Problem | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // onReady mới nhất - vòng hỏi tiến độ không phải dựng lại mỗi lần trang render
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  // Hàm dịch mã lỗi đổi identity mỗi lượt render (đồng hồ render lại mỗi giây) -
  // để trong deps là vòng hỏi bị dựng lại liên tục và không bao giờ kịp hỏi
  const errorTextRef = useRef(errorText);
  errorTextRef.current = errorText;

  const loadProviders = useCallback(async () => {
    setProvidersError(null);
    try {
      const res = await getImageProviders();
      setProviders(Array.isArray(res?.providers) ? res.providers : []);
    } catch (err) {
      setProviders([]);
      setProvidersError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const configured = useMemo(() => (providers ?? []).filter((p) => p.configured), [providers]);
  // Provider đã chọn không còn cấu hình (vừa xóa token) → về Tự động
  useEffect(() => {
    if (provider !== "auto" && providers && !configured.some((p) => p.id === provider)) setProvider("auto");
  }, [provider, providers, configured]);

  // ---- vòng hỏi tiến độ ----
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (pendingByProject.get(projectId)?.taskId === pending.taskId) pendingByProject.delete(projectId);
      setPending(null);
    };
    const poll = async () => {
      try {
        const task = await getGenerateImageTask(projectId, pending.taskId);
        if (stopped) return;
        pending.netFails = 0;
        if (task.status === "done" && task.relPath) {
          finish();
          setDone(task.relPath);
          onReadyRef.current({ relPath: task.relPath, purpose: pending.purpose });
          return;
        }
        if (task.status === "failed" || (task.status === "done" && !task.relPath)) {
          finish();
          const code = task.error?.code ?? "GATEWAY_FAILED";
          setProblem({ code, message: errorTextRef.current(code), detail: task.error?.message });
          return;
        }
      } catch (err) {
        if (stopped) return;
        // 404 = server đã khởi động lại, lượt chạy trong bộ nhớ mất theo
        if (err instanceof ApiError && err.status === 404) {
          finish();
          setProblem({ code: "lost", message: errorTextRef.current("lost"), detail: err.message });
          return;
        }
        pending.netFails += 1;
        if (pending.netFails >= 5) {
          finish();
          const code = err instanceof ApiError ? err.code : "network";
          setProblem({
            code,
            message: errorTextRef.current(code),
            detail: err instanceof Error ? err.message : String(err),
          });
          return;
        }
      }
      if (!stopped) timer = setTimeout(() => void poll(), POLL_MS);
    };
    timer = setTimeout(() => void poll(), POLL_MS);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [pending, projectId]);

  // Đồng hồ đếm giờ - chỉ chạy khi có lượt đang chờ
  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [pending]);

  const start = async (purpose: AiImagePurpose) => {
    const text = prompt.trim();
    if (!text || pending || starting || readOnly) return;
    setStarting(true);
    setProblem(null);
    setDone(null);
    try {
      const { taskId } = await generateProjectImage(projectId, {
        prompt: text,
        provider: provider === "auto" ? "auto" : (provider as ImageProviderId),
        purpose,
        ...(allowText ? { allowText: true } : {}),
      });
      const task: PendingTask = { taskId, purpose, startedAt: Date.now(), netFails: 0 };
      pendingByProject.set(projectId, task);
      setPending(task);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "network";
      setProblem({ code, message: errorText(code), detail: err instanceof Error ? err.message : String(err) });
    } finally {
      setStarting(false);
    }
  };

  const cancel = () => {
    pendingByProject.delete(projectId);
    setPending(null);
    setProblem(null);
  };

  const busy = pending !== null || starting;
  const tooLong = prompt.length > PROMPT_MAX;
  const canStart = !readOnly && !busy && prompt.trim() !== "" && !tooLong;
  const noProvider = providers !== null && configured.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-meta text-[var(--text-muted)]">{t("editor.ai.intro")}</p>

      {noProvider && (
        <Banner
          tone="info"
          message={providersError ? t("editor.ai.providers-error") : t("editor.ai.no-provider")}
          detail={providersError}
        >
          {/* Nút đặt DƯỚI câu thông báo (không dùng `actions` cạnh bên): cột thư
              viện chỉ ~264px, đặt cạnh là chữ bị ép thành một cột một ký tự */}
          <div className="mt-2 flex flex-wrap gap-2">
            <LinkButton href="/connections" small>
              {t("editor.ai.open-connections")}
            </LinkButton>
            {providersError && (
              <Button variant="secondary" small onClick={() => void loadProviders()}>
                {t("common.retry")}
              </Button>
            )}
          </div>
        </Banner>
      )}

      <Field
        label={t("editor.ai.prompt")}
        htmlFor="ai-image-prompt"
        hint={t("editor.ai.prompt-hint")}
        error={tooLong ? tf("editor.ai.prompt-too-long", { n: PROMPT_MAX }) : null}
      >
        <textarea
          id="ai-image-prompt"
          className="input"
          rows={4}
          value={prompt}
          disabled={readOnly || busy}
          placeholder={t("editor.ai.prompt-placeholder")}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </Field>

      <Field label={t("editor.ai.provider")} htmlFor="ai-image-provider">
        <select
          id="ai-image-provider"
          className="input"
          value={provider}
          disabled={readOnly || busy || providers === null}
          onChange={(e) => setProvider(e.target.value)}
        >
          <option value="auto">{t("editor.ai.provider-auto")}</option>
          {configured.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label || p.id}
            </option>
          ))}
        </select>
      </Field>

      <CheckboxField
        id="ai-image-allow-text"
        label={t("editor.ai.allow-text")}
        hint={t("editor.ai.allow-text-hint")}
        checked={allowText}
        disabled={readOnly || busy}
        onChange={setAllowText}
      />

      <div className="flex flex-col gap-2">
        <Button disabled={!canStart} onClick={() => void start("filler")} title={t("editor.ai.as-filler-hint")}>
          <ImagePlus size={14} strokeWidth={2} />
          {t("editor.ai.as-filler")}
        </Button>
        <Button variant="secondary" disabled={!canStart} onClick={() => void start("layer")} title={t("editor.ai.as-layer-hint")}>
          <Layers size={14} strokeWidth={2} />
          {t("editor.ai.as-layer")}
        </Button>
      </div>

      {(pending || starting) && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2 text-sm">
              <Sparkles size={14} strokeWidth={2} className="shrink-0 text-[var(--primary)]" />
              <span className="min-w-0 truncate">
                {pending
                  ? tf("editor.ai.running", { time: fmtElapsed((now - pending.startedAt) / 1000) })
                  : t("editor.ai.starting")}
              </span>
            </span>
            {pending && (
              <Button variant="secondary" small onClick={cancel}>
                <X size={14} strokeWidth={2} />
                {t("editor.ai.cancel")}
              </Button>
            )}
          </div>
          <div className="progress-indeterminate" aria-hidden="true" />
          <p className="text-meta text-[var(--text-muted)]">{t("editor.ai.running-hint")}</p>
        </div>
      )}

      {problem && (
        <Banner
          tone="danger"
          message={problem.message}
          detail={problem.detail}
        >
          {AI_IMAGE_CONFIG_ERRORS.has(problem.code) && (
            <div className="mt-2 flex flex-wrap gap-2">
              <LinkButton href="/connections" small>
                {t("editor.ai.open-connections")}
              </LinkButton>
            </div>
          )}
        </Banner>
      )}

      {done && !problem && !busy && (
        <Banner tone="success" message={t("editor.ai.done")}>
          <p className="mt-1 text-meta [overflow-wrap:anywhere]">{done}</p>
        </Banner>
      )}
    </div>
  );
}
