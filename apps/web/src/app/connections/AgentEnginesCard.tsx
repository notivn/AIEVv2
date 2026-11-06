"use client";

/**
 * Card "Agent điều khiển" — engine nào điều khiển được việc dựng video:
 * Claude Code (Agent SDK, kiến trúc gốc) và các agent CLI subscription
 * (Codex CLI = ChatGPT, Gemini CLI, OpenCode, lệnh tùy chỉnh).
 *
 * Trạng thái cài đặt từ GET /api/providers (field `engines` — server probe
 * `--version` + Claude auth, cache 60s). Engine "custom" cấu hình lệnh tại đây
 * (PUT /api/render-settings — aiCustomCliCommand).
 *
 * Người dùng CHỌN engine lúc gửi chat (ModelPicker trên khung chat), card này
 * chỉ cho biết cái gì đã sẵn sàng + chỗ cấu hình.
 */

import { Check, Loader2, Terminal } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  getProviders,
  getRenderSettings,
  updateRenderSettings,
  type EngineStatus,
} from "@/lib/api";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Field } from "@/components/Field";
import { Row } from "./shared";
import { CardIcon, SavedNotice, type ErrorReporter } from "./shared";
import { useT } from "@/lib/i18n";

export function AgentEnginesCard({ onError }: { onError: ErrorReporter }) {
  const { t } = useT();
  const errKey = "agent-engines";

  const [engines, setEngines] = useState<EngineStatus[] | null>(null);
  const [customCommand, setCustomCommand] = useState("");
  const [customDirty, setCustomDirty] = useState(false);
  const [savingCustom, setSavingCustom] = useState(false);
  const [customSaved, setCustomSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prov, rs] = await Promise.all([getProviders(), getRenderSettings()]);
      setEngines(prov.engines);
      setCustomCommand(rs.settings.aiCustomCliCommand ?? "");
      onError(errKey, null);
    } catch (e) {
      onError(errKey, {
        message: "Không tải được trạng thái agent",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onSaveCustom() {
    if (savingCustom) return;
    setSavingCustom(true);
    onError(errKey, null);
    setCustomSaved(false);
    try {
      await updateRenderSettings({ aiCustomCliCommand: customCommand.trim() });
      setCustomSaved(true);
      // custom engine "installed" phụ thuộc lệnh này → reload trạng thái
      const prov = await getProviders();
      setEngines(prov.engines);
    } catch (e) {
      onError(errKey, {
        message: "Không lưu được lệnh CLI tùy chỉnh",
        detail: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSavingCustom(false);
    }
  }

  return (
    <Card
      title={
        <>
          <CardIcon icon={Terminal} />
          <span>Agent điều khiển</span>
        </>
      }
    >
      <div>
        <Row>
          <p className="text-meta text-[var(--text-muted)]">
            AI nào đứng sau khung chat / phiên dựng video — chọn lúc gửi tin nhắn. Engine CLI dùng
            subscription đã login trên máy (không cần API key); chọn ở ModelPicker trên khung chat.
          </p>
        </Row>
        {(engines ?? []).map((e) => (
          <Row key={e.id}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{e.label}</span>
              {e.installed ? (
                <Badge tone="success" label="Sẵn sàng" />
              ) : (
                <Badge tone="muted" label="Chưa sẵn sàng" />
              )}
            </div>
            {e.id === "claude" && (
              <p className="mt-1 text-meta text-[var(--text-muted)]">
                Kiến trúc gốc — có nhớ phiên (resume), hiện usage/cost. Đăng nhập Claude Code hoặc điền
                ANTHROPIC_API_KEY.
              </p>
            )}
            {!e.installed && e.hint && (
              <p className="mt-1 text-meta text-[var(--text-muted)]">{e.hint}</p>
            )}
          </Row>
        ))}

        {/* Lệnh CLI tùy chỉnh — engine "custom" */}
        <Row>
          <Field
            label="Lệnh CLI tùy chỉnh (engine “Tùy chỉnh”)"
            htmlFor="agent-custom-cli"
            hint='Template bắt buộc chứa {prompt_file} — prompt được ghi ra file tạm rồi thay vào. Ví dụ: agy run --prompt-file {prompt_file}. Chỉ điền lệnh của chính bạn.'
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="agent-custom-cli"
                className="input min-w-[260px] flex-1"
                type="text"
                value={customCommand}
                placeholder="agy run --prompt-file {prompt_file}"
                autoComplete="off"
                spellCheck={false}
                disabled={savingCustom}
                onChange={(e) => {
                  setCustomCommand(e.target.value);
                  setCustomDirty(true);
                  setCustomSaved(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveCustom();
                }}
              />
              <Button
                small
                variant="secondary"
                onClick={onSaveCustom}
                disabled={savingCustom || !customDirty}
              >
                {savingCustom ? (
                  <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                ) : (
                  <Check size={13} strokeWidth={2} />
                )}
                {savingCustom ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </Field>
          {customSaved && (
            <p className="mt-2">
              <SavedNotice>Đã lưu lệnh CLI tùy chỉnh</SavedNotice>
            </p>
          )}
        </Row>
      </div>
    </Card>
  );
}
