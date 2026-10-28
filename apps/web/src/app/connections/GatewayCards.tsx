"use client";

/**
 * Card tạo ảnh của trang Kết nối (docs/EDITOR-V2-PLAN.md §4.3):
 * - ChatgptGatewayCard: tài khoản ChatGPT web qua sidecar chatgpt2api
 * - GeminiWebCard: cookie gemini.google.com qua worker gemini-webapi
 * - ImageProviderCard: chọn nhà cung cấp tạo ảnh mặc định
 *
 * Cùng quy ước với ProviderCard ở page.tsx: lỗi TẢI và HÀNH ĐỘNG đi lên
 * <ErrorBanner> cấp trang qua `onError`; Banner trong card chỉ dành cho kết
 * quả bấm "Kiểm tra kết nối", trạng thái chưa cài (kèm nút cài) và lời cảnh
 * báo điều khoản - không phải lỗi hệ thống.
 *
 * TOKEN/COOKIE CHỈ ĐI MỘT CHIỀU: ô nhập xóa trắng ngay khi gửi xong, server
 * chỉ trả lại email/gói/PSID đã che - không chỗ nào trên trang hiện lại giá
 * trị thật.
 */

import {
  Cookie,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  MessagesSquare,
  PlugZap,
  Save,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  addChatgptAccount,
  deleteChatgptAccount,
  deleteGeminiWebCookies,
  fixDoctor,
  getChatgptGateway,
  getGeminiWeb,
  getImageProviders,
  setDefaultImageProvider,
  setGatewayImageDelay,
  setGeminiWebCookies,
  testChatgptGateway,
  testGeminiWeb,
  type ChatgptAccount,
  type ChatgptGatewayInfo,
  type GatewayTestResult,
  type GeminiWebInfo,
  type ImageProviderId,
  type ImageProvidersResponse,
} from "@/lib/api";
import { Badge, type BadgeTone } from "@/components/Badge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { ConfirmDeleteModal } from "@/components/ConfirmDeleteModal";
import { Field } from "@/components/Field";
import { IconButton } from "@/components/IconButton";
import { OptionCard, OptionCardGroup } from "@/components/OptionCard";
import { Segmented } from "@/components/Segmented";
import { refreshProviders } from "@/components/ModelPicker";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
  CardIcon,
  Row,
  SavedNotice,
  errText,
  type ErrorReporter,
} from "./shared";

/** Mục doctor cài venv gateway (dùng chung cho ChatGPT và Gemini web). */
const GATEWAY_DOCTOR_ID = "image-gateway";

const CHATGPT_SESSION_URL = "https://chatgpt.com/api/auth/session";
const CHATGPT_HOME_URL = "https://chatgpt.com";
const GEMINI_HOME_URL = "https://gemini.google.com";

/** Token còn dưới ngần này thì nhắc "sắp hết hạn". */
const EXPIRY_WARN_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Tông badge theo trạng thái server soạn. Server dịch trạng thái của upstream
 * (kể cả chữ Trung của chatgpt2api) nhưng chưa chốt bộ giá trị, nên đoán theo
 * từ khóa - không khớp gì thì về xám, KHÔNG tô xanh một trạng thái lạ.
 */
function statusTone(status: string): BadgeTone {
  const v = status.toLowerCase();
  if (/^(ok|active|normal|valid|ready|healthy|正常)/.test(v)) return "success";
  if (/(expired|invalid|error|fail|disabled|banned|unauth|异常|禁用|失效)/.test(v))
    return "danger";
  return "muted";
}

/** Nhãn trạng thái: có bản dịch `conn.gateway.status.<x>` thì dùng, không thì giữ nguyên. */
function useStatusLabel() {
  const { t } = useT();
  return (status: string) => {
    const key = `conn.gateway.status.${status.toLowerCase()}`;
    const translated = t(key);
    return translated === key ? status : translated;
  };
}

/** Link mở tab mới - cùng kiểu với "Lấy key tại đây" của ProviderCard. */
function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 font-medium text-[var(--primary)] hover:underline"
    >
      {children}
      <ExternalLink size={12} strokeWidth={2} className="shrink-0" />
    </a>
  );
}

/** Cảnh báo điều khoản - giống hệt nhau ở hai card gateway. */
function TermsBanner() {
  const { t } = useT();
  return <Banner tone="muted" message={t("conn.gateway.terms")} />;
}

/**
 * Venv gateway chưa cài → Banner kèm nút cài một chạm (POST /api/doctor/fix,
 * cùng client với trang Cấu hình). Cài xong báo `onInstalled` để mọi card
 * gateway đọc lại trạng thái.
 */
function InstallGatewayBanner({
  errKey,
  onError,
  onInstalled,
}: {
  errKey: string;
  onError: ErrorReporter;
  onInstalled: () => void;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  async function install() {
    if (busy) return;
    setBusy(true);
    onError(errKey, null);
    try {
      const res = await fixDoctor(GATEWAY_DOCTOR_ID);
      // Chỉ coi là LỖI khi server nói rõ installed === false (như SystemCheckCard)
      if (res.installed === false) {
        onError(errKey, {
          message: t("conn.gateway.install-error"),
          detail: res.log.length > 0 ? res.log.join("\n") : undefined,
        });
      }
    } catch (e) {
      onError(errKey, {
        message: t("conn.gateway.install-error"),
        detail: errText(e),
      });
    } finally {
      setBusy(false);
      onInstalled();
    }
  }

  return (
    <Banner
      tone="info"
      message={t("conn.gateway.not-installed")}
      actions={
        <Button small onClick={install} disabled={busy}>
          {busy ? (
            <Loader2 size={13} strokeWidth={2} className="animate-spin" />
          ) : (
            <Download size={13} strokeWidth={2} />
          )}
          {busy ? t("conn.gateway.installing") : t("conn.gateway.install")}
        </Button>
      }
    >
      <p className="mt-1 text-meta">{t("conn.gateway.install-note")}</p>
    </Banner>
  );
}

/** Nút "Kiểm tra kết nối" + kết quả ngay dưới nút - cùng hình với ProviderCard. */
function TestRow({
  run,
  disabled,
}: {
  run: () => Promise<GatewayTestResult>;
  disabled?: boolean;
}) {
  const { t } = useT();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<GatewayTestResult | null>(null);

  async function onTest() {
    setTesting(true);
    setResult(null);
    try {
      setResult(await run());
    } catch (e) {
      setResult({ ok: false, message: errText(e) });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Row>
      <div className="flex flex-col gap-2">
        <div>
          <Button
            variant="secondary"
            small
            onClick={onTest}
            disabled={testing || disabled}
          >
            {testing ? (
              <Loader2 size={14} strokeWidth={2} className="animate-spin" />
            ) : (
              <PlugZap size={14} strokeWidth={2} />
            )}
            {testing ? t("conn.testing") : t("conn.test")}
          </Button>
        </div>
        {result && (
          <Banner tone={result.ok ? "success" : "danger"} message={result.message} />
        )}
      </div>
    </Row>
  );
}

// =====================================================================
// ChatGPT (tài khoản web)
// =====================================================================

function AccountRow({
  account,
  busy,
  onDelete,
}: {
  account: ChatgptAccount;
  busy: boolean;
  onDelete: () => void;
}) {
  const { t, tf } = useT();
  const statusLabel = useStatusLabel();
  const name = account.email || account.id;

  const expiresMs = account.expiresAt ? Date.parse(account.expiresAt) : NaN;
  const now = Date.now();
  const expired = Number.isFinite(expiresMs) && expiresMs <= now;
  const expiringSoon =
    Number.isFinite(expiresMs) && !expired && expiresMs - now < EXPIRY_WARN_MS;

  const meta: string[] = [];
  if (typeof account.imageQuotaRemaining === "number") {
    meta.push(
      tf("conn.gateway.chatgpt.quota", { n: account.imageQuotaRemaining })
    );
  }
  if (account.resetAt) {
    meta.push(
      tf("conn.gateway.chatgpt.reset", { time: formatRelative(account.resetAt) })
    );
  }
  if (account.expiresAt) {
    meta.push(
      tf("conn.gateway.chatgpt.expires", {
        time: formatDateTime(account.expiresAt),
      })
    );
  }

  return (
    <li className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 truncate text-sm font-medium" title={name}>
            {name}
          </span>
          {account.plan && <Badge tone="muted" dot={false} label={account.plan} />}
          <Badge tone={statusTone(account.status)} label={statusLabel(account.status)} />
          {expired && <Badge tone="danger" label={t("conn.gateway.chatgpt.expired")} />}
          {expiringSoon && (
            <Badge tone="danger" label={t("conn.gateway.chatgpt.expiring-soon")} />
          )}
        </div>
        {meta.length > 0 && (
          <p className="mt-1 text-meta text-[var(--text-muted)]">{meta.join(" · ")}</p>
        )}
      </div>
      <IconButton
        label={t("conn.gateway.chatgpt.delete")}
        size="sm"
        tone="danger"
        disabled={busy}
        onClick={onDelete}
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </IconButton>
    </li>
  );
}

export function ChatgptGatewayCard({
  onError,
  onChanged,
  reloadSignal,
}: {
  onError: ErrorReporter;
  /** Danh sách tài khoản / trạng thái cài đổi → trang báo các card tạo ảnh đọc lại */
  onChanged: () => void;
  reloadSignal: number;
}) {
  const { t, tf } = useT();
  const [info, setInfo] = useState<ChatgptGatewayInfo | null>(null);
  const [session, setSession] = useState("");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatgptAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await getChatgptGateway());
      onError("gw-chatgpt-load", null);
    } catch (e) {
      onError("gw-chatgpt-load", {
        message: t("conn.gateway.chatgpt.load-error"),
        detail: errText(e),
      });
    }
  }, [onError, t]);

  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  async function onAdd() {
    const value = session.trim();
    if (!value || adding) return;
    setAdding(true);
    setAdded(false);
    onError("gw-chatgpt-action", null);
    try {
      await addChatgptAccount(value);
      // Token rời ô nhập ngay - không giữ lại trong state của trang
      setSession("");
      setAdded(true);
      refreshProviders();
      onChanged();
    } catch (e) {
      onError("gw-chatgpt-action", {
        message: t("conn.gateway.chatgpt.add-error"),
        detail: errText(e),
      });
    } finally {
      setAdding(false);
    }
  }

  async function onDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    onError("gw-chatgpt-action", null);
    try {
      await deleteChatgptAccount(deleteTarget.id);
      setAdded(false);
      refreshProviders();
      onChanged();
    } catch (e) {
      onError("gw-chatgpt-action", {
        message: t("conn.gateway.chatgpt.delete-error"),
        detail: errText(e),
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const installed = info?.installed ?? false;
  const accounts = info?.accounts ?? [];
  // Sidecar không lên/không trả lời: accounts rỗng lúc này KHÔNG phải "chưa có tài khoản"
  const gatewayError = installed ? (info?.error ?? null) : null;

  return (
    <Card
      title={
        <span className="flex min-w-0 items-center gap-2">
          <CardIcon icon={MessagesSquare} />
          <span className="truncate">{t("conn.gateway.chatgpt.title")}</span>
        </span>
      }
      hint={{
        titleKey: "help.gateway-chatgpt.title",
        bodyKey: "help.gateway-chatgpt.body",
      }}
      actions={
        info && (
          <Badge
            tone={!installed ? "muted" : gatewayError ? "danger" : accounts.length > 0 ? "success" : "muted"}
            label={
              !installed
                ? t("conn.gateway.badge.not-installed")
                : gatewayError
                  ? t("conn.gateway.chatgpt.badge-error")
                  : accounts.length > 0
                    ? tf("conn.gateway.chatgpt.badge-accounts", {
                        n: accounts.length,
                      })
                    : t("conn.gateway.chatgpt.badge-none")
            }
          />
        )
      }
    >
      <div className="divide-y divide-[var(--border)]">
        <Row>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--text-muted)]">
              {t("conn.gateway.chatgpt.desc")}
            </p>
            <TermsBanner />
            {gatewayError && (
              <Banner
                tone="danger"
                message={t("conn.gateway.chatgpt.unavailable")}
                detail={`${gatewayError.code}: ${gatewayError.message}`}
              />
            )}
            {info && !installed && (
              <InstallGatewayBanner
                errKey="gw-install"
                onError={onError}
                onInstalled={onChanged}
              />
            )}
          </div>
        </Row>

        <Row>
          <Field
            label={t("conn.gateway.chatgpt.session-label")}
            htmlFor="gw-chatgpt-session"
          >
            <ol className="mb-2 list-decimal pl-5 text-meta text-[var(--text-muted)]">
              <li>
                {t("conn.gateway.chatgpt.step-1")}{" "}
                <ExtLink href={CHATGPT_HOME_URL}>chatgpt.com</ExtLink>
              </li>
              <li>
                {t("conn.gateway.chatgpt.step-2")}{" "}
                <ExtLink href={CHATGPT_SESSION_URL}>chatgpt.com/api/auth/session</ExtLink>
              </li>
              <li>{t("conn.gateway.chatgpt.step-3")}</li>
            </ol>
            <textarea
              id="gw-chatgpt-session"
              className="input font-mono"
              rows={3}
              value={session}
              placeholder={'{"user":{…},"accessToken":"eyJ…"}'}
              autoComplete="off"
              spellCheck={false}
              disabled={adding || !installed}
              onChange={(e) => {
                setSession(e.target.value);
                setAdded(false);
              }}
            />
          </Field>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              small
              onClick={onAdd}
              disabled={!session.trim() || adding || !installed}
            >
              {adding ? (
                <Loader2 size={13} strokeWidth={2} className="animate-spin" />
              ) : (
                <UserPlus size={13} strokeWidth={2} />
              )}
              {adding ? t("conn.gateway.chatgpt.adding") : t("conn.gateway.chatgpt.add")}
            </Button>
            {added && <SavedNotice>{t("conn.gateway.chatgpt.added")}</SavedNotice>}
          </div>
        </Row>

        <Row>
          <p className="label mb-2">{t("conn.gateway.chatgpt.accounts")}</p>
          {accounts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">
              {gatewayError ? t("conn.gateway.chatgpt.accounts-unknown") : t("conn.gateway.chatgpt.no-accounts")}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {accounts.map((a) => (
                <AccountRow
                  key={a.id}
                  account={a}
                  busy={deleting}
                  onDelete={() => setDeleteTarget(a)}
                />
              ))}
            </ul>
          )}
        </Row>

        <TestRow
          run={testChatgptGateway}
          disabled={!installed || accounts.length === 0}
        />
      </div>

      <ConfirmDeleteModal
        open={deleteTarget !== null}
        title={t("conn.gateway.chatgpt.delete-title")}
        description={
          <>
            {t("conn.gateway.chatgpt.delete-desc-1")}{" "}
            <span className="font-medium">
              {deleteTarget?.email || deleteTarget?.id}
            </span>
            ? {t("conn.gateway.chatgpt.delete-desc-2")}
          </>
        }
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
      />
    </Card>
  );
}

// =====================================================================
// Gemini (cookie web)
// =====================================================================

type CookieMode = "fields" | "cookie";

/** Ô nhập bí mật có nút hiện/ẩn - cùng kiểu với ô API key của ProviderCard. */
function SecretInput({
  id,
  value,
  placeholder,
  disabled,
  onChange,
  onEnter,
}: {
  id: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        className="input pr-9 font-mono"
        type={show ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onEnter();
        }}
      />
      <IconButton
        label={show ? t("conn.gateway.gemini.hide") : t("conn.gateway.gemini.show")}
        size="sm"
        className="absolute top-1/2 right-1 -translate-y-1/2"
        onClick={() => setShow((v) => !v)}
      >
        {show ? (
          <EyeOff size={15} strokeWidth={1.75} />
        ) : (
          <Eye size={15} strokeWidth={1.75} />
        )}
      </IconButton>
    </div>
  );
}

export function GeminiWebCard({
  onError,
  onChanged,
  reloadSignal,
}: {
  onError: ErrorReporter;
  onChanged: () => void;
  reloadSignal: number;
}) {
  const { t, tf } = useT();
  const statusLabel = useStatusLabel();
  const [info, setInfo] = useState<GeminiWebInfo | null>(null);
  const [mode, setMode] = useState<CookieMode>("fields");
  const [psid, setPsid] = useState("");
  const [psidts, setPsidts] = useState("");
  const [cookie, setCookie] = useState("");
  const [saving, setSaving] = useState(false);
  /** Kết quả lưu cookie - server thử cookie luôn nên trả {ok, message} như nút kiểm tra */
  const [saveResult, setSaveResult] = useState<GatewayTestResult | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await getGeminiWeb());
      onError("gw-gemini-load", null);
    } catch (e) {
      onError("gw-gemini-load", {
        message: t("conn.gateway.gemini.load-error"),
        detail: errText(e),
      });
    }
  }, [onError, t]);

  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  const installed = info?.installed ?? false;
  const canSave =
    installed && !saving && (mode === "fields" ? psid.trim() !== "" : cookie.trim() !== "");

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setSaveResult(null);
    onError("gw-gemini-action", null);
    try {
      const res = await setGeminiWebCookies(
        mode === "fields"
          ? {
              psid: psid.trim(),
              ...(psidts.trim() ? { psidts: psidts.trim() } : {}),
            }
          : { cookie: cookie.trim() }
      );
      // Cookie rời ô nhập ngay - không giữ lại trong state của trang
      setPsid("");
      setPsidts("");
      setCookie("");
      setSaveResult(res);
      refreshProviders();
      onChanged();
    } catch (e) {
      onError("gw-gemini-action", {
        message: t("conn.gateway.gemini.save-error"),
        detail: errText(e),
      });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (deleting) return;
    setDeleting(true);
    setSaveResult(null);
    onError("gw-gemini-action", null);
    try {
      await deleteGeminiWebCookies();
      refreshProviders();
      onChanged();
    } catch (e) {
      onError("gw-gemini-action", {
        message: t("conn.gateway.gemini.delete-error"),
        detail: errText(e),
      });
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const configured = info?.configured ?? false;

  return (
    <Card
      title={
        <span className="flex min-w-0 items-center gap-2">
          <CardIcon icon={Cookie} />
          <span className="truncate">{t("conn.gateway.gemini.title")}</span>
        </span>
      }
      hint={{
        titleKey: "help.gateway-gemini.title",
        bodyKey: "help.gateway-gemini.body",
      }}
      actions={
        info && (
          <Badge
            tone={!installed || !configured ? "muted" : statusTone(info.status)}
            label={
              !installed
                ? t("conn.gateway.badge.not-installed")
                : !configured
                  ? t("conn.gateway.gemini.badge-none")
                  : statusLabel(info.status)
            }
          />
        )
      }
    >
      <div className="divide-y divide-[var(--border)]">
        <Row>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[var(--text-muted)]">
              {t("conn.gateway.gemini.desc")}
            </p>
            <TermsBanner />
            {info && !installed && (
              <InstallGatewayBanner
                errKey="gw-install"
                onError={onError}
                onInstalled={onChanged}
              />
            )}
          </div>
        </Row>

        {/* Cookie đang dùng - chỉ PSID đã che, không bao giờ giá trị thật */}
        {info && configured && (
          <Row>
            <p className="label mb-1">{t("conn.gateway.gemini.current")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-[var(--radius)] bg-[var(--bg-subtle)] px-2 py-1 font-mono text-meta">
                {info.psidMasked || "__Secure-1PSID"}
              </code>
              <Badge tone={statusTone(info.status)} label={statusLabel(info.status)} />
              {/* Nút PHÁ HỦY tách sang mép phải, như "Xóa key" của ProviderCard */}
              <Button
                variant="destructive"
                small
                className="ml-auto"
                disabled={deleting || saving}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 size={13} strokeWidth={2} />
                {deleting ? t("common.deleting") : t("conn.gateway.gemini.delete")}
              </Button>
            </div>
            <p className="mt-1 text-meta text-[var(--text-muted)]">
              {info.lastOkAt
                ? tf("conn.gateway.gemini.last-ok", {
                    time: formatRelative(info.lastOkAt),
                  })
                : t("conn.gateway.gemini.never-ok")}
            </p>
          </Row>
        )}

        <Row>
          <div className="flex flex-col gap-3">
            <ol className="list-decimal pl-5 text-meta text-[var(--text-muted)]">
              <li>
                {t("conn.gateway.gemini.step-1")}{" "}
                <ExtLink href={GEMINI_HOME_URL}>gemini.google.com</ExtLink>
              </li>
              <li>{t("conn.gateway.gemini.step-2")}</li>
              <li>{t("conn.gateway.gemini.step-3")}</li>
            </ol>
            <Segmented<CookieMode>
              label={t("conn.gateway.gemini.mode-label")}
              value={mode}
              onChange={setMode}
              disabled={saving}
              options={[
                { value: "fields", label: t("conn.gateway.gemini.mode-fields") },
                { value: "cookie", label: t("conn.gateway.gemini.mode-cookie") },
              ]}
            />
            {mode === "fields" ? (
              <>
                <Field label="__Secure-1PSID" htmlFor="gw-gemini-psid">
                  <SecretInput
                    id="gw-gemini-psid"
                    value={psid}
                    placeholder="g.a000…"
                    disabled={saving || !installed}
                    onChange={setPsid}
                    onEnter={onSave}
                  />
                </Field>
                <Field
                  label="__Secure-1PSIDTS"
                  htmlFor="gw-gemini-psidts"
                  hint={t("conn.gateway.gemini.psidts-hint")}
                >
                  <SecretInput
                    id="gw-gemini-psidts"
                    value={psidts}
                    placeholder="sidts-…"
                    disabled={saving || !installed}
                    onChange={setPsidts}
                    onEnter={onSave}
                  />
                </Field>
              </>
            ) : (
              <Field
                label={t("conn.gateway.gemini.cookie-label")}
                htmlFor="gw-gemini-cookie"
                hint={t("conn.gateway.gemini.cookie-hint")}
              >
                <textarea
                  id="gw-gemini-cookie"
                  className="input font-mono"
                  rows={3}
                  value={cookie}
                  placeholder="__Secure-1PSID=…; __Secure-1PSIDTS=…; …"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={saving || !installed}
                  onChange={(e) => setCookie(e.target.value)}
                />
              </Field>
            )}
            <div className="flex flex-col gap-2">
              <div>
                <Button small onClick={onSave} disabled={!canSave}>
                  {saving ? (
                    <Loader2 size={13} strokeWidth={2} className="animate-spin" />
                  ) : (
                    <Save size={13} strokeWidth={2} />
                  )}
                  {saving ? t("common.saving") : t("conn.gateway.gemini.save")}
                </Button>
              </div>
              {saveResult && (
                <Banner
                  tone={saveResult.ok ? "success" : "danger"}
                  message={saveResult.message}
                />
              )}
            </div>
          </div>
        </Row>

        <TestRow run={testGeminiWeb} disabled={!installed || !configured} />
      </div>

      <ConfirmDeleteModal
        open={deleteOpen}
        title={t("conn.gateway.gemini.delete-title")}
        description={t("conn.gateway.gemini.delete-desc")}
        busy={deleting}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
      />
    </Card>
  );
}

// =====================================================================
// Tạo ảnh mặc định
// =====================================================================

type ProviderChoice = ImageProviderId | "auto";

/** Khớp GATEWAY_DELAY_MAX_SEC phía server (imageProviders/index.ts) */
const GATEWAY_DELAY_MAX_SEC = 600;

// KEY dictionary - dịch bằng t() lúc render
const CHOICES: { value: ProviderChoice; label: string; desc: string; reason: string }[] = [
  {
    value: "auto",
    label: "conn.imageProvider.auto",
    desc: "conn.imageProvider.auto-desc",
    reason: "conn.imageProvider.auto-reason",
  },
  {
    value: "gemini-api",
    label: "conn.imageProvider.gemini-api",
    desc: "conn.imageProvider.gemini-api-desc",
    reason: "conn.imageProvider.gemini-api-reason",
  },
  {
    value: "chatgpt-web",
    label: "conn.imageProvider.chatgpt-web",
    desc: "conn.imageProvider.chatgpt-web-desc",
    reason: "conn.imageProvider.chatgpt-web-reason",
  },
  {
    value: "gemini-web",
    label: "conn.imageProvider.gemini-web",
    desc: "conn.imageProvider.gemini-web-desc",
    reason: "conn.imageProvider.gemini-web-reason",
  },
];

export function ImageProviderCard({
  onError,
  reloadSignal,
}: {
  onError: ErrorReporter;
  reloadSignal: number;
}) {
  const { t, tf } = useT();
  const [info, setInfo] = useState<ImageProvidersResponse | null>(null);
  const [saving, setSaving] = useState<ProviderChoice | null>(null);
  const [saved, setSaved] = useState(false);
  // Ô số giây nghỉ: chuỗi đang gõ, null = đang hiện đúng giá trị của server
  const [delayDraft, setDelayDraft] = useState<string | null>(null);
  const [delaySaving, setDelaySaving] = useState(false);
  const [delaySaved, setDelaySaved] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await getImageProviders());
      setDelayDraft(null);
      onError("img-provider-load", null);
    } catch (e) {
      onError("img-provider-load", {
        message: t("conn.imageProvider.load-error"),
        detail: errText(e),
      });
    }
  }, [onError, t]);

  useEffect(() => {
    load();
  }, [load, reloadSignal]);

  /** "auto" luôn dùng được; còn lại theo `configured` của server. */
  function configuredOf(value: ProviderChoice): boolean {
    if (value === "auto") return true;
    return info?.providers.some((p) => p.id === value && p.configured) ?? false;
  }

  async function choose(value: ProviderChoice) {
    if (!info || saving || info.default === value) return;
    setSaving(value);
    setSaved(false);
    onError("img-provider-action", null);
    try {
      const res = await setDefaultImageProvider(value);
      setInfo((prev) => (prev ? { ...prev, default: res.default } : prev));
      setSaved(true);
    } catch (e) {
      onError("img-provider-action", {
        message: t("conn.imageProvider.save-error"),
        detail: errText(e),
      });
    } finally {
      setSaving(null);
    }
  }

  const delayText = delayDraft ?? (info ? String(info.gatewayDelaySec) : "");
  const delayValue = /^\d+$/.test(delayText.trim()) ? Number(delayText.trim()) : NaN;
  const delayValid = Number.isInteger(delayValue) && delayValue >= 0 && delayValue <= GATEWAY_DELAY_MAX_SEC;
  const delayDirty = info !== null && delayDraft !== null && delayValue !== info.gatewayDelaySec;

  async function saveDelay() {
    if (!delayValid || !delayDirty || delaySaving) return;
    setDelaySaving(true);
    setDelaySaved(false);
    onError("img-provider-action", null);
    try {
      const res = await setGatewayImageDelay(delayValue);
      setInfo((prev) => (prev ? { ...prev, gatewayDelaySec: res.gatewayDelaySec } : prev));
      setDelayDraft(null);
      setDelaySaved(true);
    } catch (e) {
      onError("img-provider-action", {
        message: t("conn.imageProvider.save-error"),
        detail: errText(e),
      });
    } finally {
      setDelaySaving(false);
    }
  }

  return (
    <Card
      title={
        <span className="flex min-w-0 items-center gap-2">
          <CardIcon icon={ImagePlus} />
          <span className="truncate">{t("conn.imageProvider.title")}</span>
        </span>
      }
      hint={{
        titleKey: "help.image-provider.title",
        bodyKey: "help.image-provider.body",
      }}
    >
      <div className="divide-y divide-[var(--border)]">
        <Row>
          <p className="text-sm text-[var(--text-muted)]">
            {t("conn.imageProvider.desc")}
          </p>
        </Row>
        <Row>
          <OptionCardGroup
            label={t("conn.imageProvider.title")}
            className="grid-cols-1 sm:grid-cols-2"
          >
            {CHOICES.map((c) => {
              const ok = configuredOf(c.value);
              const selected = info?.default === c.value;
              return (
                <OptionCard
                  key={c.value}
                  selected={selected}
                  // Đang được chọn mà vừa mất cấu hình thì vẫn để bấm được (không
                  // khóa trạng thái hiện tại); chỉ khóa lựa chọn MỚI chưa cấu hình
                  disabled={!info || saving !== null || (!ok && !selected)}
                  onSelect={() => choose(c.value)}
                  title={t(c.label)}
                  description={ok ? t(c.desc) : t(c.reason)}
                  badge={
                    saving === c.value ? (
                      <Loader2
                        size={13}
                        strokeWidth={2}
                        className="shrink-0 animate-spin text-[var(--text-muted)]"
                      />
                    ) : !ok ? (
                      <Badge
                        tone="muted"
                        dot={false}
                        label={t("conn.imageProvider.not-configured")}
                      />
                    ) : undefined
                  }
                />
              );
            })}
          </OptionCardGroup>
          {saved && (
            <p className="mt-2">
              <SavedNotice>{t("conn.saved")}</SavedNotice>
            </p>
          )}
        </Row>
        <Row>
          <Field
            label={t("conn.imageProvider.delay-label")}
            htmlFor="img-gateway-delay"
            hint={t("conn.imageProvider.delay-hint")}
            error={
              delayDraft !== null && !delayValid
                ? tf("conn.imageProvider.delay-invalid", { max: GATEWAY_DELAY_MAX_SEC })
                : null
            }
          >
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void saveDelay();
              }}
            >
              <input
                id="img-gateway-delay"
                className="input w-28"
                type="number"
                inputMode="numeric"
                min={0}
                max={GATEWAY_DELAY_MAX_SEC}
                step={1}
                value={delayText}
                disabled={!info || delaySaving}
                onChange={(e) => {
                  setDelayDraft(e.target.value);
                  setDelaySaved(false);
                }}
              />
              <span className="text-sm text-[var(--text-muted)]">{t("conn.imageProvider.delay-unit")}</span>
              <Button
                type="submit"
                variant="secondary"
                disabled={!delayDirty || !delayValid || delaySaving}
              >
                {delaySaving ? (
                  <Loader2 size={14} strokeWidth={2} className="animate-spin" />
                ) : (
                  <Save size={14} strokeWidth={2} />
                )}
                {t("conn.imageProvider.delay-save")}
              </Button>
              {delaySaved && <SavedNotice>{t("conn.saved")}</SavedNotice>}
            </form>
          </Field>
        </Row>
      </div>
    </Card>
  );
}
