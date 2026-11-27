import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import "@/styles/fiscal-admin.css";
import {
  getFiscalDocumentDetail,
  getFiscalHealth,
  getFiscalOverview,
  listEmailDeliveries,
  listFiscalAudit,
  listFiscalDocuments,
  type AuditEntry,
  type DocumentDetail,
  type EmailDeliverySummary,
  type FiscalDocumentSummary,
  type FiscalHealth,
  type FiscalOverview,
  type Page,
} from "@/lib/fiscal-admin";

const PAGE_SIZE = 25;
const AUDIT_PAGE_SIZE = 50;

const ENVIRONMENT_OPTIONS = [
  { value: "demo", label: "Demo" },
  { value: "production", label: "Production" },
] as const;

const DOCUMENT_STATUSES = ["pending", "submitting", "signed", "rejected", "unknown", "unverified"] as const;
const EMAIL_STATUSES = ["queued", "sending", "sent", "failed", "dead"] as const;

type Tone = "good" | "pending" | "bad" | "uncertain" | "neutral";

const STATUS_TONE: Record<string, Tone> = {
  signed: "good",
  sent: "good",
  pending: "pending",
  submitting: "pending",
  queued: "pending",
  sending: "pending",
  rejected: "bad",
  failed: "bad",
  dead: "bad",
  unknown: "uncertain",
  unverified: "uncertain",
};

interface RpcState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unexpected error while loading data.";
}

/**
 * Loads data through an RPC wrapper. Re-runs when any dependency changes or when reload() is called.
 * A response from a superseded request is ignored, so a slow older call cannot overwrite newer data.
 * Passing null skips loading and resets the state.
 */
function useRpc<T>(
  load: (() => Promise<T>) | null,
  deps: readonly unknown[],
): RpcState<T> & { reload: () => void } {
  const [state, setState] = useState<RpcState<T>>({
    data: null,
    error: null,
    loading: load !== null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!load) {
      setState({ data: null, error: null, loading: false });
      return;
    }
    let active = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    load().then(
      (data) => {
        if (active) setState({ data, error: null, loading: false });
      },
      (err: unknown) => {
        if (active) setState({ data: null, error: errorMessage(err), loading: false });
      },
    );
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers list every value the loader reads
  }, [...deps, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

function toneFor(status: string): Tone {
  return STATUS_TONE[status] ?? "neutral";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatMoney(minor: string | null, currency: string | null): string {
  if (minor === null || currency === null) return "—";
  const amount = Number(minor) / 100;
  if (!Number.isFinite(amount)) return `${minor} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function strOrNull(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="fx-panel">
      <div className="fx-panel__head">
        <h2 className="fx-panel__title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Alert({ message }: { message: string }) {
  return (
    <div role="alert" className="fx-alert">
      {message}
    </div>
  );
}

function RpcBody<T>({ state, render }: { state: RpcState<T>; render: (data: T) => ReactNode }) {
  if (state.error) return <Alert message={state.error} />;
  if (state.data === null) return <p className="fx-muted">Loading…</p>;
  return (
    <>
      {state.loading && <p className="fx-muted">Updating…</p>}
      {render(state.data)}
    </>
  );
}

function Stat({ label, value, tone = "neutral" }: { label: string; value: number | string; tone?: Tone }) {
  return (
    <div className={`fx-stat fx-stat--${tone}`}>
      <p className="fx-stat__label">{label}</p>
      <p className="fx-stat__value">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`fx-badge fx-badge--${toneFor(status)}`}>{status}</span>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Pager({
  page,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="fx-pager">
      <button
        type="button"
        className="fx-btn fx-btn--ghost"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </button>
      <span className="fx-muted">
        Page {page} of {pageCount} · {total} total
      </span>
      <button
        type="button"
        className="fx-btn fx-btn--ghost"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}

function OverviewSection({ state }: { state: RpcState<FiscalOverview> }) {
  return (
    <Panel title="Overview">
      <RpcBody
        state={state}
        render={(data) => {
          const docs = data.documents_by_status;
          const emails = data.emails_by_status;
          const total = Object.values(docs).reduce((sum, n) => sum + n, 0);
          return (
            <>
              <div className="fx-stats">
                <Stat label="Total documents" value={total} />
                <Stat label="Signed" value={docs.signed ?? 0} tone="good" />
                <Stat label="Pending" value={docs.pending ?? 0} tone="pending" />
                <Stat label="Rejected" value={docs.rejected ?? 0} tone="bad" />
                <Stat label="Unknown" value={docs.unknown ?? 0} tone="uncertain" />
              </div>

              <h3 className="fx-subhead">Email deliveries</h3>
              <div className="fx-stats">
                <Stat label="Sent" value={emails.sent ?? 0} tone="good" />
                <Stat label="Queued" value={emails.queued ?? 0} tone="pending" />
                <Stat label="Failed" value={emails.failed ?? 0} tone="bad" />
                <Stat label="Dead" value={emails.dead ?? 0} tone="bad" />
              </div>

              <h3 className="fx-subhead">Queue status</h3>
              {data.queue_states.length === 0 ? (
                <p className="fx-muted">No fiscal queue state is recorded.</p>
              ) : (
                <ul className="fx-queue">
                  {data.queue_states.map((q) => (
                    <li key={`${q.environment}:${q.merchant_id}`} className="fx-queue__item">
                      <span>
                        {q.environment} · merchant {q.merchant_id}
                      </span>
                      <StatusBadge status={q.status} />
                      <span className="fx-muted">Last checked {formatDateTime(q.last_checked_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      />
    </Panel>
  );
}

interface DocumentsSectionProps {
  environment: string;
  onEnvironmentChange: (value: string) => void;
  status: string;
  onStatusChange: (value: string) => void;
  searchInput: string;
  onSearchChange: (value: string) => void;
  state: RpcState<Page<FiscalDocumentSummary>>;
  page: number;
  onPageChange: (page: number) => void;
  onSelect: (id: string) => void;
}

function DocumentsSection(props: DocumentsSectionProps) {
  const {
    environment,
    onEnvironmentChange,
    status,
    onStatusChange,
    searchInput,
    onSearchChange,
    state,
    page,
    onPageChange,
    onSelect,
  } = props;

  return (
    <Panel title="Fiscal documents">
      <div className="fx-filters">
        <input
          type="search"
          className="fx-input"
          placeholder="Receipt reference, receipt ID, order code or email"
          aria-label="Search fiscal documents"
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <select
          className="fx-select"
          aria-label="Filter by environment"
          value={environment}
          onChange={(e) => onEnvironmentChange(e.target.value)}
        >
          <option value="">All environments</option>
          {ENVIRONMENT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          className="fx-select"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="">All statuses</option>
          {DOCUMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <RpcBody
        state={state}
        render={(data) =>
          data.rows.length === 0 ? (
            <p className="fx-muted">No documents match these filters.</p>
          ) : (
            <>
              <div className="fx-table-wrap">
                <table className="fx-table">
                  <thead>
                    <tr>
                      <th>Receipt reference</th>
                      <th>Environment</th>
                      <th>Receipt ID</th>
                      <th>Amount</th>
                      <th>Customer email</th>
                      <th>Payment order</th>
                      <th>Receipt date</th>
                      <th>Signing status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <button type="button" className="fx-link" onClick={() => onSelect(row.id)}>
                            {row.receipt_reference}
                          </button>
                        </td>
                        <td>{row.environment}</td>
                        <td>{row.ft_receipt_identification ?? "—"}</td>
                        <td>{formatMoney(row.amount_minor, row.currency_code)}</td>
                        <td>{row.customer_email ?? "—"}</td>
                        <td>{row.payment_order_code ?? "—"}</td>
                        <td>{formatDateTime(row.receipt_moment)}</td>
                        <td>
                          <StatusBadge status={row.status} />
                          {row.signed_at && <span className="fx-muted"> {formatDateTime(row.signed_at)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={onPageChange} />
            </>
          )
        }
      />
    </Panel>
  );
}

function EmailTable({ rows, showDocument }: { rows: EmailDeliverySummary[]; showDocument: boolean }) {
  if (rows.length === 0) return <p className="fx-muted">No email deliveries.</p>;
  return (
    <div className="fx-table-wrap">
      <table className="fx-table">
        <thead>
          <tr>
            <th>Recipient</th>
            {showDocument && <th>Document</th>}
            <th>Status</th>
            <th>Attempts</th>
            <th>Next retry</th>
            <th>Provider message ID</th>
            <th>Last error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.recipient}</td>
              {showDocument && <td>{row.receipt_reference ?? (row.document_id ? shortId(row.document_id) : "—")}</td>}
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td>{row.attempts}</td>
              <td>{formatDateTime(row.next_attempt_at)}</td>
              <td>{row.provider_message_id ?? "—"}</td>
              <td>{row.last_error ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface EmailSectionProps {
  status: string;
  onStatusChange: (value: string) => void;
  state: RpcState<Page<EmailDeliverySummary>>;
  page: number;
  onPageChange: (page: number) => void;
}

function EmailSection({ status, onStatusChange, state, page, onPageChange }: EmailSectionProps) {
  return (
    <Panel title="Email deliveries">
      <div className="fx-filters">
        <select
          className="fx-select"
          aria-label="Filter deliveries by status"
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="">All statuses</option>
          {EMAIL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <RpcBody
        state={state}
        render={(data) => (
          <>
            <EmailTable rows={data.rows} showDocument />
            <Pager page={page} total={data.total} pageSize={PAGE_SIZE} onPageChange={onPageChange} />
          </>
        )}
      />
    </Panel>
  );
}

function AuditTable({ rows, showDocument }: { rows: AuditEntry[]; showDocument: boolean }) {
  if (rows.length === 0) return <p className="fx-muted">No audit records.</p>;
  return (
    <div className="fx-table-wrap">
      <table className="fx-table">
        <thead>
          <tr>
            <th>Actor</th>
            <th>Action</th>
            <th>Details</th>
            {showDocument && <th>Document</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.document_id ?? "none"}:${index}`}>
              <td>{row.actor}</td>
              <td>{row.action}</td>
              <td>
                <code className="fx-code">{row.details ? JSON.stringify(row.details) : "—"}</code>
              </td>
              {showDocument && (
                <td title={row.document_id ?? undefined}>{row.document_id ? shortId(row.document_id) : "—"}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentDetailBody({ detail }: { detail: DocumentDetail }) {
  const doc = detail.document;
  const get = (key: string) => formatValue(doc[key]);

  return (
    <>
      <h3 className="fx-subhead">Receipt</h3>
      <dl className="fx-dl">
        <Field label="Receipt reference">{get("receipt_reference")}</Field>
        <Field label="Environment">{get("environment")}</Field>
        <Field label="Receipt kind">{get("receipt_kind")}</Field>
        <Field label="Signing status">
          <StatusBadge status={get("status")} />
        </Field>
        <Field label="Viva receipt identification">{get("ft_receipt_identification")}</Field>
        <Field label="Receipt date">{formatDateTime(strOrNull(doc.receipt_moment))}</Field>
        <Field label="Signed at">{formatDateTime(strOrNull(doc.signed_at))}</Field>
        <Field label="Amount">{formatMoney(strOrNull(doc.amount_minor), strOrNull(doc.currency_code))}</Field>
        <Field label="Customer email">{get("customer_email")}</Field>
        <Field label="Customer name">{get("customer_name")}</Field>
        <Field label="Payment order code">{get("payment_order_code")}</Field>
        <Field label="Payment transaction ID">{get("payment_transaction_id")}</Field>
        <Field label="Raw transmission indicator">
          {get("transmission_indicator")}
          <span className="fx-muted fx-block">
            Raw value as stored. It does not confirm AADE/myDATA transmission.
          </span>
        </Field>
      </dl>

      <h3 className="fx-subhead">Email deliveries</h3>
      <EmailTable rows={detail.emails} showDocument={false} />

      <h3 className="fx-subhead">Audit history</h3>
      <AuditTable rows={detail.audit} showDocument={false} />

      <details className="fx-details">
        <summary>All stored fields</summary>
        <dl className="fx-dl">
          {Object.entries(doc).map(([key, value]) => (
            <Field key={key} label={key}>
              <code className="fx-code">{formatValue(value)}</code>
            </Field>
          ))}
        </dl>
      </details>
    </>
  );
}

function DetailPanel({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const detail = useRpc<DocumentDetail | null>(
    () => getFiscalDocumentDetail(supabase, documentId),
    [documentId],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data, error, loading } = detail;

  return (
    <aside className="fx-drawer" aria-label="Document details">
      <div className="fx-panel__head">
        <h2 className="fx-panel__title">Document details</h2>
        <div className="fx-actions">
          <button type="button" className="fx-btn fx-btn--ghost" onClick={detail.reload}>
            Reload
          </button>
          <button type="button" className="fx-btn fx-btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      {loading && !data && !error && <p className="fx-muted">Loading…</p>}
      {error && <Alert message={error} />}
      {!loading && !error && data === null && <p className="fx-muted">Document not found.</p>}
      {data && <DocumentDetailBody detail={data} />}
    </aside>
  );
}

function HealthSection({ state }: { state: RpcState<FiscalHealth> }) {
  return (
    <Panel title="System health">
      <RpcBody
        state={state}
        render={(health) => {
          const vivaVerified = health.viva_fiscal === "verified";
          const aadeVerified = health.aade_mydata === "verified";
          return (
            <>
              <dl className="fx-dl">
                <Field label="Database">
                  <span className={`fx-badge fx-badge--${health.database_reachable ? "good" : "bad"}`}>
                    {health.database_reachable ? "Reachable" : "Unreachable"}
                  </span>
                </Field>
                <Field label="Checked at">{formatDateTime(health.checked_at)}</Field>
                <Field label="Viva Fiscal">
                  <span className={`fx-badge fx-badge--${vivaVerified ? "good" : "uncertain"}`}>
                    {vivaVerified ? "Verified" : "Not verified"}
                  </span>
                </Field>
                <Field label="AADE/myDATA">
                  <span className={`fx-badge fx-badge--${aadeVerified ? "good" : "uncertain"}`}>
                    {aadeVerified ? "Verified" : "Unverified"}
                  </span>
                </Field>
              </dl>

              <h3 className="fx-subhead">Document queue</h3>
              <dl className="fx-dl">
                <Field label="Pending">{health.documents.pending ?? 0}</Field>
                <Field label="Submitting">{health.documents.submitting ?? 0}</Field>
                <Field label="Rejected">{health.documents.rejected ?? 0}</Field>
                <Field label="Unknown">{health.documents.unknown ?? 0}</Field>
                <Field label="Unverified">{health.documents.unverified ?? 0}</Field>
              </dl>

              <h3 className="fx-subhead">Email queue</h3>
              <dl className="fx-dl">
                <Field label="Due now">{health.emails.queued_due ?? 0}</Field>
                <Field label="Sending">{health.emails.sending ?? 0}</Field>
                <Field label="Failed">{health.emails.failed ?? 0}</Field>
                <Field label="Dead">{health.emails.dead ?? 0}</Field>
              </dl>

              <h3 className="fx-subhead">Fiscal queue states</h3>
              {health.queue_states.length === 0 ? (
                <p className="fx-muted">No fiscal queue state is recorded.</p>
              ) : (
                <ul className="fx-queue">
                  {health.queue_states.map((q) => (
                    <li key={`${q.environment}:${q.merchant_id}`} className="fx-queue__item">
                      <span>
                        {q.environment} · merchant {q.merchant_id}
                      </span>
                      <StatusBadge status={q.status} />
                      <span className="fx-muted">Last checked {formatDateTime(q.last_checked_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      />
    </Panel>
  );
}

function AuditSection({
  state,
  page,
  onPageChange,
}: {
  state: RpcState<Page<AuditEntry>>;
  page: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <Panel title="Audit log">
      <RpcBody
        state={state}
        render={(data) => (
          <>
            <AuditTable rows={data.rows} showDocument />
            <Pager page={page} total={data.total} pageSize={AUDIT_PAGE_SIZE} onPageChange={onPageChange} />
          </>
        )}
      />
    </Panel>
  );
}

function FiscalAdminPage() {
  const [environment, setEnvironment] = useState("");
  const [status, setStatus] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [documentPage, setDocumentPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState("");
  const [emailPage, setEmailPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setDocumentPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const overview = useRpc<FiscalOverview>(
    () => getFiscalOverview(supabase, environment || undefined),
    [environment],
  );

  const documents = useRpc<Page<FiscalDocumentSummary>>(
    () =>
      listFiscalDocuments(supabase, {
        environment: environment || undefined,
        status: status || undefined,
        search: search || undefined,
        page: documentPage,
        pageSize: PAGE_SIZE,
      }),
    [environment, status, search, documentPage],
  );

  const emails = useRpc<Page<EmailDeliverySummary>>(
    () => listEmailDeliveries(supabase, emailStatus || undefined, emailPage, PAGE_SIZE),
    [emailStatus, emailPage],
  );

  const audit = useRpc<Page<AuditEntry>>(
    () => listFiscalAudit(supabase, null, auditPage, AUDIT_PAGE_SIZE),
    [auditPage],
  );

  const health = useRpc<FiscalHealth>(() => getFiscalHealth(supabase), []);

  const reloadAll = () => {
    overview.reload();
    documents.reload();
    emails.reload();
    audit.reload();
    health.reload();
    setRefreshKey((k) => k + 1);
  };

  const closeDetail = useCallback(() => setSelectedId(null), []);

  return (
    <div className="fx-page">
      <header className="fx-header">
        <div>
          <p className="fx-eyebrow">AURA Academy · Admin</p>
          <h1 className="fx-title">Fiscal Control Center</h1>
          <p className="fx-sub">
            Read-only view of fiscal documents, email deliveries and queue health. Resend and recovery actions
            are not on this page yet.
          </p>
        </div>
        <button type="button" className="fx-btn" onClick={reloadAll}>
          Refresh
        </button>
      </header>

      <OverviewSection state={overview} />

      <DocumentsSection
        environment={environment}
        onEnvironmentChange={(value) => {
          setEnvironment(value);
          setDocumentPage(1);
        }}
        status={status}
        onStatusChange={(value) => {
          setStatus(value);
          setDocumentPage(1);
        }}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        state={documents}
        page={documentPage}
        onPageChange={setDocumentPage}
        onSelect={setSelectedId}
      />

      <EmailSection
        status={emailStatus}
        onStatusChange={(value) => {
          setEmailStatus(value);
          setEmailPage(1);
        }}
        state={emails}
        page={emailPage}
        onPageChange={setEmailPage}
      />

      <HealthSection state={health} />

      <AuditSection state={audit} page={auditPage} onPageChange={setAuditPage} />

      {selectedId && (
        <DetailPanel key={`${selectedId}:${refreshKey}`} documentId={selectedId} onClose={closeDetail} />
      )}
    </div>
  );
}

export const Route = createFileRoute("/admin/fiscal")({
  component: FiscalAdminPage,
});