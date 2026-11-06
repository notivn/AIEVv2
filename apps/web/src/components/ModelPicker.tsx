"use client";

/**
 * Chọn model Claude + chế độ (effort) cho phiên AI - dùng ở:
 * - Modal "Bắt đầu edit bằng AI" (khối AiModelBlock đầy đủ, có badge kết nối)
 * - ChatThread khi tạo phiên MỚI (hàng AiModelInlineRow gọn phía trên input)
 *
 * Danh sách model + trạng thái kết nối lấy từ GET /api/providers, cache
 * module-level trong một phiên UI. Gemini chỉ hiện dạng thông tin - provider
 * đó dành cho tính năng Tạo ảnh, không dùng cho chat/edit.
 */

import { AlertTriangle, Info } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Field } from "@/components/Field";
import { InfoHint } from "@/components/InfoHint";
import { Panel } from "@/components/Panel";
import {
  getClaudeModels,
  getProviders,
  type AgentEffort,
  type AgentEngineId,
  type EngineStatus,
  type Provider,
  type ProviderModel,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

/**
 * Model mặc định cho phiên AI mới.
 *
 * SONNET CHỨ KHÔNG PHẢI MODEL MẠNH NHẤT - đây là quyết định về TIỀN, đo trên
 * dữ liệu thật của dự án chứ không phải cảm tính:
 *
 * - Dựng một video tiêu khoảng 24,6 triệu token VÀO và 0,08 triệu token RA.
 *   Tỉ lệ 300:1, nên gần như toàn bộ chi phí nằm ở giá token vào; giá token ra
 *   gần như không ảnh hưởng gì.
 * - Giá token vào: Fable 5.1 $10, Opus 5.5 $4, Sonnet 5.5 $2, Haiku 5.5 $0,10
 *   mỗi triệu.
 * - Quy ra mỗi video (sau prompt cache): Fable 5.1 ~$50, Opus 5.5 ~$20,
 *   Sonnet 5.5 ~$10.
 *
 * Ra thế hệ mới thì đổi sang Sonnet MỚI NHẤT (cùng giá, giỏi hơn) - để mặc định
 * ở thế hệ cũ là người dùng không bao giờ được dùng model mới trừ khi tự đổi.
 *
 * Trước đây mặc định là Fable 5 - model đắt nhất - nên mỗi video tốn gấp hơn ba
 * lần mức cần thiết cho công việc dựng video vốn đã có skill hướng dẫn từng
 * bước. Người dùng vẫn chọn được model mạnh hơn trong ô ngay cạnh; đây chỉ là
 * điểm khởi đầu hợp lý, không phải giới hạn.
 */
export const DEFAULT_MODEL = "claude-sonnet-5-5";
export const DEFAULT_EFFORT: AgentEffort = "medium";

/** Engine điều khiển agent mặc định - Agent SDK của Claude (kiến trúc gốc). */
export const DEFAULT_ENGINE: AgentEngineId = "claude";

/**
 * Engine điều khiển agent: "claude" = Agent SDK (có memory phiên, usage/cost);
 * còn lại = agent CLI subscription đã login trên máy (xem trang Kết nối →
 * "Agent điều khiển"). Nhãn KHÔNG dịch qua i18n — tên sản phẩm.
 */
export const ENGINE_OPTIONS: Array<{ id: AgentEngineId; label: string }> = [
  { id: "claude", label: "Claude Code" },
  { id: "codex", label: "Codex CLI (ChatGPT)" },
  { id: "gemini", label: "Gemini CLI" },
  { id: "opencode", label: "OpenCode" },
  { id: "custom", label: "CLI tùy chỉnh" },
];

export const EFFORT_OPTIONS: {
  value: AgentEffort;
  label: string;
  hint: string;
}[] = [
  // label/hint là KEY dictionary - dịch bằng t() lúc render
  { value: "low", label: "effort.low", hint: "effort.low-hint" },
  { value: "medium", label: "effort.medium", hint: "effort.medium-hint" },
  { value: "high", label: "effort.high", hint: "effort.high-hint" },
];

/**
 * Fallback khi chưa fetch được /api/providers - chỉ để select không trống.
 * Nhãn phải BÁM THEO DEFAULT_MODEL: trước đây nó ghi cứng "Claude Fable 5",
 * nên đổi model mặc định mà quên chỗ này là ô select hiện sai tên model, người
 * dùng tưởng đang chạy model khác hẳn với thứ thật sự được gọi.
 */
const FALLBACK_MODELS = [{ id: DEFAULT_MODEL, label: "Claude Sonnet 5.5" }];

// KEY dictionary - dịch bằng t() lúc render
const GEMINI_TOOLTIP = "model.gemini-tooltip";

// Cache module-level - providers thay đổi khi sửa .env/đăng nhập lại,
// một lần fetch mỗi phiên UI là đủ.
let providersCache: Provider[] | null = null;
let providersPromise: Promise<Provider[]> | null = null;
let enginesCache: EngineStatus[] | null = null;

/**
 * Bust cache providers - gọi sau khi đổi/xóa API key ở trang Kết nối để các
 * select model/provider nơi khác fetch lại danh sách mới ở lần mount sau.
 */
export function refreshProviders(): void {
  providersCache = null;
  providersPromise = null;
  enginesCache = null;
}

export function useProviders(): {
  providers: Provider[] | null;
  engines: EngineStatus[] | null;
  error: string | null;
} {
  const [providers, setProviders] = useState<Provider[] | null>(providersCache);
  const [engines, setEngines] = useState<EngineStatus[] | null>(enginesCache);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (providersCache) return;
    let alive = true;
    if (!providersPromise) {
      providersPromise = getProviders().then((r) => {
        providersCache = r.providers;
        enginesCache = r.engines ?? null;
        return r.providers;
      });
    }
    providersPromise
      .then((list) => {
        if (alive) {
          setProviders(list);
          setEngines(enginesCache);
        }
      })
      .catch((e) => {
        // fetch hỏng → cho phép thử lại ở lần mount sau
        providersPromise = null;
        if (alive) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      alive = false;
    };
  }, []);

  return { providers, engines, error };
}

/**
 * Danh sách model Claude live - lazy: chỉ fetch khi user chạm vào select Model
 * lần đầu (load()), giống useGeminiImageModels. Server cache 10 phút; chưa
 * fetch xong thì UI vẫn dùng danh sách tĩnh từ /api/providers.
 */
export function useClaudeModels() {
  const [models, setModels] = useState<ProviderModel[] | null>(null);
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    try {
      const { models } = await getClaudeModels();
      setModels(models);
    } catch {
      // lỗi mạng → cho phép thử lại ở lần focus sau, UI vẫn còn danh sách tĩnh
      startedRef.current = false;
    }
  }, []);

  return { models, load };
}

interface PickerProps {
  model: string;
  effort: AgentEffort;
  onModelChange: (model: string) => void;
  onEffortChange: (effort: AgentEffort) => void;
  /** Engine điều khiển agent - mặc định claude SDK (tương thích caller cũ) */
  engine?: AgentEngineId;
  onEngineChange?: (engine: AgentEngineId) => void;
  disabled?: boolean;
}

/** Option label có chú thích trạng thái cài đặt (từ GET /api/providers engines) */
function engineOptionLabel(e: { id: AgentEngineId; label: string }, statuses: EngineStatus[] | null): string {
  const s = statuses?.find((x) => x.id === e.id);
  return s && !s.installed ? `${e.label} — chưa sẵn sàng` : e.label;
}

function claudeModels(claude: Provider | undefined) {
  return claude && claude.models.length > 0 ? claude.models : FALLBACK_MODELS;
}

/** Khối "AI thực hiện" trong modal Bắt đầu edit - engine + model + mode + trạng thái kết nối. */
export function AiModelBlock({
  model,
  effort,
  onModelChange,
  onEffortChange,
  engine = DEFAULT_ENGINE,
  onEngineChange,
  disabled = false,
}: PickerProps) {
  const { t } = useT();
  const { providers, engines } = useProviders();
  const claude = providers?.find((p) => p.id === "claude");
  const gemini = providers?.find((p) => p.id === "gemini");
  const { models: liveModels, load: loadClaudeModels } = useClaudeModels();
  // Chưa fetch live → tạm dùng danh sách tĩnh từ /api/providers
  const models = liveModels ?? claudeModels(claude);
  // Model đã lưu không (chưa) nằm trong danh sách → vẫn hiển thị bằng id thô
  const modelMissing = model !== "" && !models.some((m) => m.id === model);
  const cliEngine = engine !== "claude";

  return (
    <Panel
      title={t("model.performer")}
      actions={
        // "Claude" phải đứng ngay trước huy hiệu: một mình chữ "Đã kết nối"
        // cạnh tiêu đề nhóm "AI thực hiện" thì không nói được là CÁI GÌ đang
        // kết nối. Bản cũ có chữ này, chuyển sang Panel thì rơi mất.
        claude && !cliEngine && (
          <span className="flex items-center gap-2">
            <span className="text-meta font-medium">Claude</span>
            {claude.connected ? (
              <Badge
                tone="success"
                label={
                  claude.source === "api-key"
                    ? t("model.connected-api-key")
                    : t("model.connected-subscription")
                }
              />
            ) : (
              <Badge tone="danger" label={t("model.not-connected")} />
            )}
          </span>
        )
      }
    >
      {claude && !claude.connected && !cliEngine && (
        <p className="flex items-start gap-2 text-sm font-medium text-[var(--danger)]">
          <AlertTriangle size={14} strokeWidth={2} className="mt-0.5 shrink-0" />
          {t("model.claude-warning")}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {onEngineChange && (
          <Field label="Agent điều khiển" htmlFor="ai-engine">
            <select
              id="ai-engine"
              className="input"
              value={engine}
              disabled={disabled}
              onChange={(e) => onEngineChange(e.target.value as AgentEngineId)}
            >
              {ENGINE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {engineOptionLabel(o, engines)}
                </option>
              ))}
            </select>
          </Field>
        )}
        {cliEngine ? (
          <Field label={t("model.model")} htmlFor="ai-model">
            <input
              id="ai-model"
              className="input"
              type="text"
              value={model}
              placeholder="model (tùy chọn — bỏ trống dùng mặc định của CLI)"
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => onModelChange(e.target.value)}
            />
          </Field>
        ) : (
          <Field label={t("model.model")} htmlFor="ai-model">
            <select
              id="ai-model"
              className="input"
              value={model}
              disabled={disabled}
              onFocus={loadClaudeModels}
              onChange={(e) => onModelChange(e.target.value)}
            >
              {modelMissing && <option value={model}>{model}</option>}
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!cliEngine && (
          <Field label={t("model.effort")} htmlFor="ai-effort">
            <select
              id="ai-effort"
              className="input"
              value={effort}
              disabled={disabled}
              onChange={(e) => onEffortChange(e.target.value as AgentEffort)}
            >
              {EFFORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.label)} - {t(o.hint)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      {/* GỢI Ý, KHÔNG PHẢI CƯỠNG CHẾ - model mặc định giữ nguyên, người dùng
          vẫn tự quyết. Đặt ngay dưới ô chọn vì đây đúng là lúc quyết định, chứ
          không phải sau khi phiên đã chạy và tiền đã tiêu. Chỉ có ở khối đầy đủ
          (modal Bắt đầu edit); hàng inline trong ChatThread không nhét được một
          banner mà không phá nhịp một hàng. */}
      <Banner
        tone="info"
        message={
          <>
            {t("model.cost-tip")}{" "}
            <InfoHint
              titleKey="help.model-cost.title"
              bodyKey="help.model-cost.body"
              className="align-middle"
            />
          </>
        }
      />
      {gemini && (
        <p
          className="flex items-center gap-2 text-meta text-[var(--text-muted)]"
          title={t(GEMINI_TOOLTIP)}
        >
          <Info size={14} strokeWidth={2} className="shrink-0" />
          {gemini.connected
            ? t("model.gemini-connected")
            : t("model.gemini-not-connected")}
        </p>
      )}
    </Panel>
  );
}

/** Hàng chọn engine/model/mode gọn - hiện trong ChatThread khi tạo phiên mới. */
export function AiModelInlineRow({
  model,
  effort,
  onModelChange,
  onEffortChange,
  engine = DEFAULT_ENGINE,
  onEngineChange,
  disabled = false,
}: PickerProps) {
  const { t } = useT();
  const { providers, engines } = useProviders();
  const claude = providers?.find((p) => p.id === "claude");
  const gemini = providers?.find((p) => p.id === "gemini");
  const { models: liveModels, load: loadClaudeModels } = useClaudeModels();
  // Chưa fetch live → tạm dùng danh sách tĩnh từ /api/providers
  const models = liveModels ?? claudeModels(claude);
  // Model đã lưu không (chưa) nằm trong danh sách → vẫn hiển thị bằng id thô
  const modelMissing = model !== "" && !models.some((m) => m.id === model);
  const cliEngine = engine !== "claude";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Engine đứng TRƯỚC model: đổi engine là thay cả hệ model */}
      {onEngineChange && (
        <select
          className="input w-auto"
          aria-label="Agent điều khiển"
          value={engine}
          disabled={disabled}
          onChange={(e) => onEngineChange(e.target.value as AgentEngineId)}
        >
          {ENGINE_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {engineOptionLabel(o, engines)}
            </option>
          ))}
        </select>
      )}
      {/* `.input` chuẩn, chỉ ghi đè BỀ RỘNG (w-auto) để các select nằm gọn trên
          một hàng - chiều cao và cỡ chữ giữ nguyên như mọi ô nhập khác. */}
      {cliEngine ? (
        // Engine CLI: model free-form (mỗi CLI một hệ tên) - bỏ trống = mặc định CLI
        <input
          className="input w-auto"
          type="text"
          aria-label={t("model.aria-model")}
          value={model}
          placeholder="model (tùy chọn)"
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onModelChange(e.target.value)}
        />
      ) : (
        <select
          className="input w-auto"
          aria-label={t("model.aria-model")}
          value={model}
          disabled={disabled}
          onFocus={loadClaudeModels}
          onChange={(e) => onModelChange(e.target.value)}
        >
          {modelMissing && <option value={model}>{model}</option>}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      )}
      {!cliEngine && (
        <select
          className="input w-auto"
          aria-label={t("model.aria-effort")}
          value={effort}
          disabled={disabled}
          onChange={(e) => onEffortChange(e.target.value as AgentEffort)}
        >
          {EFFORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
      )}
      {claude && !claude.connected && (
        <span
          className="inline-flex items-center gap-1 text-meta font-medium text-[var(--danger)]"
          title={t("model.claude-warning-short")}
        >
          <AlertTriangle size={13} strokeWidth={2} className="shrink-0" />
          {t("model.claude-not-connected")}
        </span>
      )}
      {gemini && (
        <span
          className="inline-flex items-center gap-1 text-meta text-[var(--text-muted)]"
          title={t(GEMINI_TOOLTIP)}
        >
          <Info size={13} strokeWidth={2} className="shrink-0" />
          {t("model.gemini-images-only")}
        </span>
      )}
    </div>
  );
}
