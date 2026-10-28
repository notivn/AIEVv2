"use client";

/**
 * "Giao cho AI" (docs/EDITOR-V2-PLAN.md §2.8, §3): người dùng đã tự chỉnh
 * timeline, nhập yêu cầu rồi để AI làm tiếp từ ĐÚNG trạng thái hiện tại.
 *
 * Server chụp revision `ai-before` trước khi agent chạy, nên AI làm hỏng thì
 * "Hoàn tác" trên banner duyệt khôi phục được. Trong lúc AI chạy trình chỉnh sửa
 * chỉ đọc (cơ chế agentBusy sẵn có) - việc đó của trang, modal chỉ mở phiên.
 */

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Segmented } from "@/components/Segmented";
import { ApiError, startEditorHandoff } from "@/lib/api";
import { useT } from "@/lib/i18n";

type FinishMode = "draft" | "final";

const INSTRUCTION_MAX = 4000;

export function HandoffModal({
  open,
  onClose,
  projectId,
  onStarted,
  beforeStart,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /**
   * Phiên AI đã mở (202) - trang khóa chỉ đọc + theo dõi tiến độ. `beforeRev` =
   * revision `ai-before` server vừa chụp (null = không chụp được) - "Hoàn tác" dùng.
   */
  onStarted: (sessionId: string, beforeRev: string | null) => void;
  /**
   * Lưu nốt thay đổi chưa lưu TRƯỚC khi giao (AI đọc meta.json trên đĩa - bản
   * chưa lưu là bản AI không thấy). Trả false = không lưu được, không giao.
   */
  beforeStart?: () => Promise<boolean>;
}) {
  const { t } = useT();
  const [instruction, setInstruction] = useState("");
  const [finishMode, setFinishMode] = useState<FinishMode>("draft");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; detail?: string } | null>(null);

  // Mở lại thì xóa lỗi cũ; GIỮ chữ đã gõ (đóng nhầm không mất yêu cầu dài)
  useEffect(() => {
    if (open) setProblem(null);
  }, [open]);

  const trimmed = instruction.trim();
  const tooLong = instruction.length > INSTRUCTION_MAX;

  const submit = async () => {
    if (!trimmed || tooLong || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      if (beforeStart && !(await beforeStart())) {
        setProblem({ message: t("editor.handoff.save-first") });
        return;
      }
      const { sessionId, beforeRev } = await startEditorHandoff(projectId, {
        instruction: trimmed,
        finishMode,
      });
      setInstruction("");
      onStarted(sessionId, beforeRev ?? null);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "AGENT_BUSY") {
        setProblem({ message: t("editor.handoff.busy") });
      } else {
        setProblem({
          message: t("editor.handoff.failed"),
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t("editor.handoff.title")}
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button disabled={busy || !trimmed || tooLong} onClick={() => void submit()}>
            <Sparkles size={14} strokeWidth={2} />
            {busy ? t("editor.handoff.starting") : t("editor.handoff.start")}
          </Button>
        </>
      }
    >
      <p className="text-sm">{t("editor.handoff.intro")}</p>
      {problem && <Banner tone="danger" message={problem.message} detail={problem.detail} />}
      <Field
        label={t("editor.handoff.instruction")}
        htmlFor="handoff-instruction"
        hint={t("editor.handoff.instruction-hint")}
        error={tooLong ? t("editor.handoff.too-long") : null}
      >
        <textarea
          id="handoff-instruction"
          className="input"
          rows={5}
          value={instruction}
          autoFocus
          placeholder={t("editor.handoff.placeholder")}
          disabled={busy}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd+Enter gửi luôn - Enter thường vẫn xuống dòng
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
      </Field>
      <Field
        label={t("editor.handoff.finish")}
        hint={finishMode === "draft" ? t("editor.handoff.finish-draft-hint") : t("editor.handoff.finish-final-hint")}
      >
        <Segmented
          label={t("editor.handoff.finish")}
          value={finishMode}
          onChange={setFinishMode}
          disabled={busy}
          options={[
            { value: "draft", label: t("editor.handoff.finish-draft") },
            { value: "final", label: t("editor.handoff.finish-final") },
          ]}
        />
      </Field>
      <p className="text-meta text-[var(--text-muted)]">{t("editor.handoff.note")}</p>
    </Modal>
  );
}
