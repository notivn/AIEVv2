"use client";

/**
 * Phần dùng chung của tính năng Tạo ảnh:
 * - nhãn loại ảnh / tỉ lệ / trạng thái (ImageStatusBadge, AspectChip)
 * - ImageProjectFields: form prompt + loại + tỉ lệ + overlay chữ (Remotion đặt)
 *   - dùng ở cả modal "Tạo ảnh mới" và trang chi tiết images/[id].
 */

import { Loader2, Plus, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  getGeminiImageModels,
  getImageProviders,
  type ImageAspect,
  type ImageKind,
  type ImageOverlay,
  type ImageProjectStatus,
  type ImageProvidersResponse,
  type ImageTextPosition,
  type ProviderModel,
} from "@/lib/api";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Field, SwitchField } from "@/components/Field";
import { IconButton } from "@/components/IconButton";
import { useProviders } from "@/components/ModelPicker";
import { OptionCard, OptionCardGroup } from "@/components/OptionCard";
import { Panel } from "@/components/Panel";
import { StyleSelect } from "@/components/StyleSelect";
import { useT } from "@/lib/i18n";

/**
 * Danh sách model ảnh Gemini live - lazy: chỉ fetch khi user chạm vào select
 * lần đầu (load()). Không cache cứng phía client - server đã cache 1h, mỗi lần
 * mount hook lại là một lần fetch mới để nhận model Google vừa phát hành.
 */
export function useGeminiImageModels() {
  const [models, setModels] = useState<ProviderModel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);

  const load = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setLoading(true);
    try {
      const { models } = await getGeminiImageModels();
      setModels(models);
    } catch {
      // lỗi mạng → cho phép thử lại ở lần focus sau, UI vẫn còn danh sách tĩnh
      startedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { models, loading, load };
}

// ---- Nhà cung cấp tạo ảnh (docs/EDITOR-V2-PLAN.md §4.3) ----
//
// Ô "model" của ảnh minh họa / Images Project nhận thêm giá trị provider:
// "auto", "chatgpt-web", "gemini-web". Id model Gemini API cũ giữ nguyên nghĩa
// (= provider gemini-api), nên brief/project cũ không đổi gì.

/** Giá trị provider chọn thẳng trong ô model (ngoài các id model Gemini API). */
export const IMAGE_PROVIDER_VALUES = ["auto", "chatgpt-web", "gemini-web"] as const;
export type ImageProviderValue = (typeof IMAGE_PROVIDER_VALUES)[number];

// KEY dictionary - dịch bằng t() lúc render
const IMAGE_PROVIDER_LABEL: Record<ImageProviderValue, string> = {
  auto: "conn.imageProvider.auto",
  "chatgpt-web": "conn.imageProvider.chatgpt-web",
  "gemini-web": "conn.imageProvider.gemini-web",
};

/**
 * GET /api/image-providers - mỗi lần mount một lần fetch (không cache module):
 * trạng thái "đã cấu hình" đổi ngay khi người dùng thêm tài khoản ở trang Kết
 * nối, cache lại là ô chọn cứ báo "chưa cấu hình" cho tới khi tải lại trang.
 * Server cũ chưa có endpoint → `failed`, ô chọn hiện đúng như trước (chỉ model
 * Gemini API).
 */
export function useImageProviders() {
  const [info, setInfo] = useState<ImageProvidersResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    getImageProviders()
      .then((r) => {
        if (alive) setInfo(r);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  return { info, failed };
}

/** Provider web (ChatGPT / Gemini web) đã cấu hình chưa - "auto" luôn chọn được. */
function providerConfigured(
  info: ImageProvidersResponse | null,
  value: ImageProviderValue
): boolean {
  if (value === "auto") return true;
  return info?.providers.some((p) => p.id === value && p.configured) ?? false;
}

/**
 * Trạng thái ô chọn model ảnh dùng chung cho BriefFields, ImageProjectFields và
 * trang images/[id]: các option provider, giá trị đã lưu có nằm ngoài danh sách
 * không (`missing` → hiện id thô), và câu gợi ý khi có provider chưa cấu hình.
 */
export function useImageModelChoices(
  current: string | null,
  geminiModels: ProviderModel[]
) {
  const { t, tf } = useT();
  const { info, failed } = useImageProviders();
  // Chưa có dữ liệu provider (đang tải / server cũ) → không vẽ nhóm provider
  const showProviders = info !== null && !failed;
  const providerOptions = showProviders
    ? IMAGE_PROVIDER_VALUES.map((value) => {
        const configured = providerConfigured(info, value);
        return {
          value,
          label: t(IMAGE_PROVIDER_LABEL[value]),
          configured,
          // Không khóa option đang được chọn: <select> với giá trị bị disabled
          // hiện sai trạng thái - thay vào đó gợi ý dưới ô báo rõ lý do
          disabled: !configured && current !== value,
        };
      })
    : [];
  const missing =
    current !== null &&
    !geminiModels.some((m) => m.id === current) &&
    !providerOptions.some((o) => o.value === current);
  const unconfigured = providerOptions.filter((o) => !o.configured);
  const selectedUnconfigured = unconfigured.find((o) => o.value === current);
  const hint = selectedUnconfigured
    ? tf("conn.imageProvider.selected-not-configured", {
        name: selectedUnconfigured.label,
      })
    : unconfigured.length > 0
      ? tf("conn.imageProvider.picker-hint", {
          names: unconfigured.map((o) => o.label).join(", "),
        })
      : undefined;
  /** Có provider web nào dùng được không - để bỏ cảnh báo "thiếu GEMINI_API_KEY". */
  const anyWebConfigured = providerOptions.some(
    (o) => o.value !== "auto" && o.configured
  );
  return { providerOptions, missing, hint, anyWebConfigured };
}

/**
 * Các <option> của ô chọn model ảnh: "Mặc định" → nhóm Nhà cung cấp → nhóm
 * Gemini API. Provider chưa cấu hình bị khóa, kèm đuôi "chưa cấu hình".
 */
export function ImageModelOptions({
  current,
  geminiModels,
  choices,
}: {
  current: string | null;
  geminiModels: ProviderModel[];
  choices: ReturnType<typeof useImageModelChoices>;
}) {
  const { t } = useT();
  const { providerOptions, missing } = choices;
  return (
    <>
      <option value="">{t("images.model-default")}</option>
      {missing && current !== null && <option value={current}>{current}</option>}
      {providerOptions.length > 0 && (
        <optgroup label={t("conn.imageProvider.group-providers")}>
          {providerOptions.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.configured
                ? o.label
                : `${o.label} - ${t("conn.imageProvider.not-configured-suffix")}`}
            </option>
          ))}
        </optgroup>
      )}
      {providerOptions.length > 0 ? (
        <optgroup label={t("conn.imageProvider.gemini-api")}>
          {geminiModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </optgroup>
      ) : (
        geminiModels.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))
      )}
    </>
  );
}

// ---- Nhãn & options ----

// label là KEY dictionary - dịch bằng t() lúc render.
export const KIND_OPTIONS: { value: ImageKind; label: string }[] = [
  { value: "background", label: "imageForm.kind.background" },
  { value: "3d", label: "imageForm.kind.3d" },
  { value: "character", label: "imageForm.kind.character" },
  { value: "texture", label: "imageForm.kind.texture" },
  { value: "product", label: "imageForm.kind.product" },
  { value: "concept", label: "imageForm.kind.concept" },
];

export const KIND_LABEL: Record<ImageKind, string> = Object.fromEntries(
  KIND_OPTIONS.map((o) => [o.value, o.label])
) as Record<ImageKind, string>;

export const ASPECT_OPTIONS: {
  value: ImageAspect;
  width: number;
  height: number;
  note: string;
}[] = [
  { value: "9:16", width: 1080, height: 1920, note: "imageForm.aspect.portrait" },
  { value: "16:9", width: 1920, height: 1080, note: "imageForm.aspect.landscape" },
  { value: "1:1", width: 1080, height: 1080, note: "imageForm.aspect.square" },
  { value: "4:5", width: 1080, height: 1350, note: "imageForm.aspect.feed" },
];

// Giá trị là KEY dictionary - dịch bằng t() lúc render.
export const STATUS_LABEL: Record<ImageProjectStatus, string> = {
  draft: "imageForm.status.draft",
  generating: "imageForm.status.generating",
  done: "imageForm.status.done",
  error: "imageForm.status.error",
};

const STATUS_TONE: Record<ImageProjectStatus, BadgeTone> = {
  draft: "muted",
  generating: "running",
  done: "success",
  error: "danger",
};

export function ImageStatusBadge({ status }: { status: ImageProjectStatus }) {
  const { t } = useT();
  return (
    <Badge
      tone={STATUS_TONE[status] ?? "muted"}
      // Chấm tự dựng thay cho chấm mặc định để gắn thêm nhịp nhấp nháy khi ĐANG
      // tạo - trạng thái tĩnh mà nhấp nháy thì mắt cứ bị kéo về chỗ không có gì
      // đang xảy ra.
      dot={false}
      label={
        <>
          <span
            className={`badge-dot ${
              status === "generating" ? "badge-dot-pulse" : ""
            }`}
          />
          {STATUS_LABEL[status] ? t(STATUS_LABEL[status]) : String(status)}
        </>
      }
    />
  );
}

/** Icon thuần CSS mô phỏng tỉ lệ khung - cùng kiểu preset video ở trang Projects. */
export function AspectIcon({
  width,
  height,
  size = 22,
}: {
  width: number;
  height: number;
  /** Cạnh dài của icon (px) - 20 cho bản gọn ở trang chi tiết. */
  size?: number;
}) {
  const style =
    width >= height
      ? { width: size, aspectRatio: `${width} / ${height}` }
      : { height: size, aspectRatio: `${width} / ${height}` };
  return (
    <span className="flex h-6 w-6 items-center justify-center" aria-hidden>
      <span
        className="block rounded-[3px] border-[1.5px] border-current"
        style={style}
      />
    </span>
  );
}

export function AspectChip({ aspect }: { aspect: ImageAspect }) {
  return <span className="chip">{aspect}</span>;
}

export const DEFAULT_OVERLAY: ImageOverlay = {
  title: "",
  subtitle: "",
  stats: [],
  cta: "",
  showLogo: true,
  position: "auto",
};

/**
 * Lưới chọn vị trí khối chữ: 3 hàng (trên/giữa/dưới) x 3 cột (trái/giữa/phải).
 * Vẽ đúng như bố cục thật để chọn bằng mắt, khỏi phải đọc tên từng vị trí.
 */
const POSITION_ROWS: { vert: "top" | "middle" | "bottom"; labelKey: string }[] = [
  { vert: "top", labelKey: "imageForm.pos-top" },
  { vert: "middle", labelKey: "imageForm.pos-middle" },
  { vert: "bottom", labelKey: "imageForm.pos-bottom" },
];
const POSITION_COLS: { horiz: "left" | "center" | "right"; labelKey: string }[] = [
  { horiz: "left", labelKey: "imageForm.pos-left" },
  { horiz: "center", labelKey: "imageForm.pos-center" },
  { horiz: "right", labelKey: "imageForm.pos-right" },
];

/**
 * Bộ chọn vị trí chữ - lưới 3x3 + nút Tự động.
 * Export vì BriefFields tái dùng cho vị trí chủ thể ảnh minh họa AI - cùng một
 * lưới giá trị, người dùng chọn bằng mắt như chọn vị trí logo.
 */
export function TextPositionPicker({
  value,
  disabled,
  onChange,
}: {
  value: ImageTextPosition;
  disabled?: boolean;
  onChange: (v: ImageTextPosition) => void;
}) {
  const { t, tf } = useT();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="grid grid-cols-3 gap-1"
        role="group"
        aria-label={t("imageForm.position-label")}
      >
        {POSITION_ROWS.map((r) =>
          POSITION_COLS.map((c) => {
            const pos = `${r.vert}-${c.horiz}` as ImageTextPosition;
            const active = value === pos;
            const label = tf("imageForm.pos-combo", {
              vert: t(r.labelKey),
              horiz: t(c.labelKey),
            });
            return (
              <button
                key={pos}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                title={label}
                aria-label={label}
                onClick={() => onChange(pos)}
                className={`flex h-8 w-11 rounded-[4px] border p-1 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
                  active
                    ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--bg-subtle)]"
                }`}
                style={{
                  // Gạch nhỏ nằm ĐÚNG góc mà chữ sẽ nằm - nhìn ô là biết ngay,
                  // không phải đọc tên vị trí
                  alignItems:
                    r.vert === "top" ? "flex-start" : r.vert === "bottom" ? "flex-end" : "center",
                  justifyContent:
                    c.horiz === "left"
                      ? "flex-start"
                      : c.horiz === "right"
                        ? "flex-end"
                        : "center",
                }}
              >
                <span
                  className="block h-[3px] w-4 rounded-full"
                  style={{
                    backgroundColor: active ? "var(--primary)" : "var(--text-muted)",
                    opacity: active ? 1 : 0.55,
                  }}
                />
              </button>
            );
          }),
        )}
      </div>
      {/* Hình dạng của <Segmented> (class .seg) nhưng chỉ MỘT mục: đây là công
          tắc "để máy tự quyết" chứ không phải nhóm radio, nên dùng aria-pressed.
          Mượn class để nó không thành cái pill thứ bảy trong app. */}
      <span className="seg">
        <button
          type="button"
          disabled={disabled}
          aria-pressed={value === "auto"}
          onClick={() => onChange("auto")}
          className="seg-item"
        >
          {t("imageForm.pos-auto")}
        </button>
      </span>
    </div>
  );
}

/** Giá trị form (không gồm tên) - modal tạo mới và trang chi tiết dùng chung. */
export interface ImageDraft {
  prompt: string;
  kind: ImageKind;
  aspect: ImageAspect;
  overlay: ImageOverlay;
  /** Model Gemini tạo nền - null = mặc định của server (Nano Banana 2). */
  model: string | null;
  /** Style Design ảnh phải tuân theo - null = style mặc định. */
  styleId: string | null;
}

export const DEFAULT_IMAGE_DRAFT: ImageDraft = {
  prompt: "",
  kind: "background",
  aspect: "9:16",
  overlay: DEFAULT_OVERLAY,
  model: null,
  styleId: null,
};

/**
 * Heading section + divider mảnh - dùng ở chế độ sectioned. Chữ lấy nguyên
 * công thức `.t-eyebrow` (12px in hoa muted) để giống hệt tiêu đề cột của
 * workspace và `<th>` của bảng - trước đây nó tự chế một biến thể riêng.
 * Đây là KIỂU TIÊU ĐỀ MỤC DUY NHẤT của file này; hộp có khung thì dùng
 * <Panel title>, không thêm kiểu thứ ba.
 */
export function FormSectionHeading({ children }: { children: ReactNode }) {
  return (
    <p className="t-eyebrow border-t border-[var(--border)] pt-3">{children}</p>
  );
}

export function ImageProjectFields({
  value,
  onChange,
  disabled = false,
  idPrefix,
  showModel = true,
  sectioned = false,
}: {
  value: ImageDraft;
  onChange: (patch: Partial<ImageDraft>) => void;
  disabled?: boolean;
  /** Tiền tố id các control - tránh trùng id khi form xuất hiện 2 nơi. */
  idPrefix: string;
  /** false = ẩn select model (trang chi tiết đã có select riêng ở hàng hành động). */
  showModel?: boolean;
  /**
   * true = chia form thành section có divider + heading uppercase
   * ("Định dạng", "Chữ trên ảnh…") và grid tỉ lệ gọn hơn - trang chi tiết dùng.
   */
  sectioned?: boolean;
}) {
  const { t, tf } = useT();
  const { prompt, kind, aspect, overlay, model, styleId } = value;
  const { providers } = useProviders();
  const geminiModels =
    providers?.find((p) => p.id === "gemini")?.models ?? [];
  const {
    models: liveModels,
    loading: modelsLoading,
    load: loadModels,
  } = useGeminiImageModels();
  // Chưa fetch live → tạm hiển thị danh sách tĩnh từ /api/providers
  const modelOptions = liveModels ?? geminiModels;
  // Provider (Tự động / ChatGPT web / Gemini web) + model đã lưu nằm ngoài danh sách
  const modelChoices = useImageModelChoices(model, modelOptions);

  function patchOverlay(patch: Partial<ImageOverlay>) {
    onChange({ overlay: { ...overlay, ...patch } });
  }

  function setStat(index: number, patch: Partial<{ label: string; value: string }>) {
    patchOverlay({
      stats: overlay.stats.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });
  }

  return (
    <>
      <Field
        label="Style Design"
        htmlFor={`${idPrefix}-style`}
        hint={t("imageForm.style-hint")}
      >
        <StyleSelect
          id={`${idPrefix}-style`}
          value={styleId}
          disabled={disabled}
          onChange={(v) => onChange({ styleId: v })}
        />
      </Field>

      <Field label={t("imageForm.prompt-label")} htmlFor={`${idPrefix}-prompt`}>
        <textarea
          id={`${idPrefix}-prompt`}
          className="input"
          rows={3}
          value={prompt}
          disabled={disabled}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={t("imageForm.prompt-placeholder")}
        />
      </Field>

      <Field label={t("imageForm.kind-label")} htmlFor={`${idPrefix}-kind`}>
        <select
          id={`${idPrefix}-kind`}
          className="input"
          value={kind}
          disabled={disabled}
          onChange={(e) => onChange({ kind: e.target.value as ImageKind })}
        >
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.label)}
            </option>
          ))}
        </select>
      </Field>

      {showModel && (
        <Field
          label={t("imageForm.model-label")}
          htmlFor={`${idPrefix}-model`}
          hint={
            modelsLoading ? (
              <span className="flex items-center gap-1">
                <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                {t("images.loading-models")}
              </span>
            ) : (
              modelChoices.hint ?? t("imageForm.model-hint")
            )
          }
        >
          <select
            id={`${idPrefix}-model`}
            className="input"
            value={model ?? ""}
            disabled={disabled}
            onFocus={loadModels}
            onChange={(e) => onChange({ model: e.target.value || null })}
          >
            <ImageModelOptions
              current={model}
              geminiModels={modelOptions}
              choices={modelChoices}
            />
          </select>
        </Field>
      )}

      {sectioned && <FormSectionHeading>{t("imageForm.format")}</FormSectionHeading>}
      <Field label={t("imageForm.aspect-label")}>
        <OptionCardGroup
          label={t("imageForm.aspect-label")}
          className="grid-cols-2 sm:grid-cols-4"
        >
          {ASPECT_OPTIONS.map((o) => (
            <OptionCard
              key={o.value}
              selected={aspect === o.value}
              disabled={disabled}
              onSelect={() => onChange({ aspect: o.value })}
              title={o.value}
              description={`${o.width}×${o.height} · ${t(o.note)}`}
              // Hình khung tỉ lệ đứng ở chỗ badge: nó là thứ đọc được bằng mắt
              // nhanh hơn cả con số, bỏ đi thì bốn thẻ chỉ khác nhau ở chữ.
              badge={
                <span className="shrink-0 text-[var(--text-muted)]">
                  <AspectIcon width={o.width} height={o.height} size={18} />
                </span>
              }
            />
          ))}
        </OptionCardGroup>
      </Field>

      {/* Tiêu đề nằm luôn trên <Panel> - cả hai chế độ dùng chung một tiêu đề,
          không còn bản uppercase riêng cho sectioned và bản 13px cho modal. */}
      <Panel title={t("imageForm.overlay-heading")} className="gap-3">
        <Field label={t("imageForm.title-label")} htmlFor={`${idPrefix}-ov-title`}>
          <input
            id={`${idPrefix}-ov-title`}
            className="input"
            value={overlay.title}
            disabled={disabled}
            onChange={(e) => patchOverlay({ title: e.target.value })}
            placeholder={t("imageForm.title-placeholder")}
          />
        </Field>
        <Field
          label={t("imageForm.subtitle-label")}
          htmlFor={`${idPrefix}-ov-subtitle`}
        >
          <input
            id={`${idPrefix}-ov-subtitle`}
            className="input"
            value={overlay.subtitle}
            disabled={disabled}
            onChange={(e) => patchOverlay({ subtitle: e.target.value })}
            placeholder={t("imageForm.subtitle-placeholder")}
          />
        </Field>
        {/* Vị trí khối chữ - đặt ngay dưới tiêu đề/mô tả vì nó quyết định bố
            cục của toàn bộ phần chữ phía dưới (stats, CTA đều đi theo) */}
        <Field
          label={t("imageForm.position-label")}
          hint={
            overlay.position === "auto"
              ? t("imageForm.position-auto-hint")
              : t("imageForm.position-hint")
          }
        >
          <TextPositionPicker
            value={overlay.position}
            disabled={disabled}
            onChange={(position) => patchOverlay({ position })}
          />
        </Field>
        <Field label={t("imageForm.stats-label")}>
          <div className="flex flex-col gap-2">
            {overlay.stats.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input flex-1"
                  aria-label={tf("imageForm.stat-label-aria", { n: i + 1 })}
                  value={s.label}
                  disabled={disabled}
                  onChange={(e) => setStat(i, { label: e.target.value })}
                  placeholder={t("imageForm.stat-label-placeholder")}
                />
                <input
                  className="input w-28"
                  aria-label={tf("imageForm.stat-value-aria", { n: i + 1 })}
                  value={s.value}
                  disabled={disabled}
                  onChange={(e) => setStat(i, { value: e.target.value })}
                  placeholder={t("imageForm.stat-value-placeholder")}
                />
                <IconButton
                  label={tf("imageForm.stat-remove-aria", { n: i + 1 })}
                  tone="danger"
                  disabled={disabled}
                  onClick={() =>
                    patchOverlay({
                      stats: overlay.stats.filter((_, j) => j !== i),
                    })
                  }
                >
                  <X size={15} strokeWidth={2} />
                </IconButton>
              </div>
            ))}
            <button
              type="button"
              disabled={disabled}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-[var(--primary)] hover:underline disabled:opacity-50"
              onClick={() =>
                patchOverlay({
                  stats: [...overlay.stats, { label: "", value: "" }],
                })
              }
            >
              <Plus size={14} strokeWidth={2} />
              {t("imageForm.add-stat")}
            </button>
          </div>
        </Field>
        <Field label="CTA" htmlFor={`${idPrefix}-ov-cta`}>
          <input
            id={`${idPrefix}-ov-cta`}
            className="input"
            value={overlay.cta}
            disabled={disabled}
            onChange={(e) => patchOverlay({ cta: e.target.value })}
            placeholder={t("imageForm.cta-placeholder")}
          />
        </Field>
        <SwitchField
          id={`${idPrefix}-ov-logo`}
          label={t("imageForm.show-logo")}
          checked={overlay.showLogo}
          disabled={disabled}
          onChange={(next) => patchOverlay({ showLogo: next })}
        />
      </Panel>

      <p className="text-meta text-[var(--text-muted)]">
        {t("imageForm.no-text-note")}
      </p>
    </>
  );
}
