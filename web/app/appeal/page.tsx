"use client";
import { Copy, Printer, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { act, openConfirm } from "@/lib/agent";
import { api } from "@/lib/api";
import { PendingConfirm, useApp } from "@/lib/store";
import { Button, Callout, Chip, PageTitle, Section, Table } from "@/components/ui";

type Sec = {
  id: string;
  title: string;
  body?: string;
  table?: { columns: string[]; rows: string[][] };
  items?: { label: string; done: boolean }[];
  placeholder?: boolean;
  cite?: string[];
};
type Packet = {
  version: number;
  title: string;
  createdAt: string;
  sections: Sec[];
  footer: string;
  source: string;
  model?: { name: string; latencyMs: number } | null;
  objections: { id: string; claim: string; why_weak: string; fix: string }[];
  diff: { op: "add" | "del"; text: string }[] | null;
  fixed?: string[];
  filed?: { confirmation: string; at: string; verification: string; sandbox: boolean };
};

function fmtDate(s?: string) {
  if (!s) return "";
  return new Date(s.length === 10 ? s + "T12:00" : s).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function pending(tool: "appeal", args: Record<string, any>, utterance: string): PendingConfirm {
  return { question: "", tool, args, kind: "task", utterance, inputMode: "text", raw: utterance, partial: false };
}

export default function AppealPage() {
  const v = useApp((s) => s.dataVersion);
  const [cov, setCov] = useState<any>(null);
  const [ap, setAp] = useState<{ latest: Packet | null; case: any } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api("/api/coverage").then(setCov).catch(() => {});
    api("/api/appeal").then(setAp).catch(() => {});
  }, [v]);

  const run = async (action: string, label: string) => {
    setBusy(action);
    await act(pending("appeal", { action }, label), true, "text");
    setBusy(null);
  };
  const file = () =>
    openConfirm({ ...pending("appeal", { action: "file" }, "File the appeal"), question: "File this appeal with Acme (sandbox)?" });

  const p = ap?.latest;
  const c = ap?.case;
  const d = cov?.denial;

  const copyText = () => {
    if (!p) return;
    const lines = [p.title, ""];
    p.sections.forEach((s) => {
      lines.push(s.title);
      if (s.body) lines.push(s.body);
      s.table?.rows.forEach((r) => lines.push(r.join(" | ")));
      s.items?.forEach((i) => lines.push(`[${i.done ? "x" : " "}] ${i.label}`));
      lines.push("");
    });
    lines.push(p.footer);
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div>
      <PageTitle emoji="📄" title="Coverage & Appeal" subtitle="Acme Health Plan (fictional) · power wheelchair" />

      {d && (
        <Callout emoji={c?.status === "appeal_filed" ? "✅" : "⚠️"} tone={c?.status === "appeal_filed" ? "success" : "warning"}>
          {c?.status === "appeal_filed" ? (
            <>
              <div className="font-medium">Appeal filed {fmtDate(c.filedOn)} · confirmation {c.confirmation} (sandbox)</div>
              <div className="text-[15px]">Acme should decide by {fmtDate(c.decisionDue)}. Nothing needed from you right now.</div>
            </>
          ) : (
            <>
              <div className="font-medium">Denied {fmtDate(d.date)}: “{d.reason}.”</div>
              <div className="text-[15px]">
                Appeal by <strong>{fmtDate(d.deadline)}</strong> · {d.daysLeft} days left · source: denial letter from {d.from}
              </div>
            </>
          )}
        </Callout>
      )}

      {cov && (
        <Section title="Coverage check">
          <blockquote className="border-l-2 border-ink pl-4 text-[15px]">
            “{cov.policy.find((x: any) => x.clause === "§4.2(a)")?.text}”
            <div className="mt-1 text-sm text-muted">— policy §4.2(a)</div>
          </blockquote>
          <ul className="mt-4 flex flex-col gap-1.5 text-[15px]">
            {cov.requirements.map((r: any) => (
              <li key={r.label} className="flex items-start gap-2">
                <span aria-hidden>{r.status === "evidence" ? "✅" : "◻️"}</span>
                <span>
                  {r.label} <span className="text-muted">· {r.evidence}</span> <Chip>{r.clause}</Chip>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[15px]">
            Estimated member cost: <strong>${cov.costShare.memberCostUsd.toLocaleString()}</strong>{" "}
            <span className="text-muted">
              (20% of ${cov.costShare.priceUsd.toLocaleString()} for the {cov.costShare.item}, {cov.costShare.note}) · policy §4.3(a)
            </span>
          </p>
        </Section>
      )}

      <Section
        title={
          <span className="flex items-center gap-2">
            Appeal packet {p && <Chip tone="accent">v{p.version}</Chip>}
            {p?.filed && (
              <Chip tone="success">
                <ShieldCheck size={12} aria-hidden /> Verified human authorised this agent
              </Chip>
            )}
          </span>
        }
      >
        {!p ? (
          <Callout emoji="✍️">
            <div>No draft yet. Milo builds it from your fit check, the policy and the denial letter.</div>
            <div className="mt-3">
              <Button variant="primary" onClick={() => run("draft", "Draft my appeal")} disabled={!!busy}>
                {busy === "draft" ? "Drafting…" : "Draft my appeal"}
              </Button>
            </div>
          </Callout>
        ) : (
          <>
            <article className="rounded-lg border border-border px-8 py-7">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-warning">Draft — for clinician review and signature</div>
              <h3 className="font-serif text-[28px] font-medium leading-tight">{p.title}</h3>
              <div className="mb-6 mt-1 flex flex-wrap gap-1.5 text-xs text-muted">
                <span>{fmtDate(p.createdAt)}</span>
                <span>·</span>
                <span>{p.source === "live" && p.model ? `⚡ large model · ${p.model.name}` : "template"}</span>
              </div>
              {p.sections.map((s) => (
                <section key={s.id} className="mb-6">
                  <h4 className="mb-1.5 text-[17px] font-semibold">{s.title}</h4>
                  {s.placeholder ? (
                    <div className="rounded border border-dashed border-border px-4 py-6 text-center text-muted">{s.body}</div>
                  ) : (
                    s.body && <p className="whitespace-pre-line text-[15px]">{s.body}</p>
                  )}
                  {s.table && (
                    <div className="mt-2">
                      <Table head={s.table.columns}>
                        {s.table.rows.map((r, i) => (
                          <tr key={i} className="border-b border-border">
                            {r.map((cell, j) => (
                              <td key={j} className="px-3 py-1.5 text-[14px]">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </Table>
                    </div>
                  )}
                  {s.items && (
                    <ul className="mt-1 flex flex-col gap-1 text-[15px]">
                      {s.items.map((it) => (
                        <li key={it.label} className="flex gap-2">
                          <span aria-hidden>{it.done ? "☑" : "☐"}</span>
                          <span className={it.done ? "" : "text-muted"}>
                            {it.label} {!it.done && <span className="text-[#b42323]">· still needed</span>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.cite && s.cite.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {s.cite.map((ct) => (
                        <Chip key={ct}>{ct}</Chip>
                      ))}
                    </div>
                  )}
                </section>
              ))}
              <p className="border-t border-border pt-3 text-sm text-muted">{p.footer}</p>
            </article>

            {/* Reviewer simulation */}
            <div className="no-print mt-6">
              {p.objections.length > 0 ? (
                <Callout emoji="🧑‍⚖️" tone="warning">
                  <div className="font-medium">Strict reviewer says…</div>
                  <ol className="mt-2 list-decimal space-y-2 pl-5 text-[15px]">
                    {p.objections.map((o) => (
                      <li key={o.id}>
                        <span className="font-medium">{o.claim}</span> {o.why_weak}
                        <div className="text-muted">Fix: {o.fix}</div>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3">
                    <Button variant="primary" onClick={() => run("revise", "Fix the appeal with Milo")} disabled={!!busy}>
                      {busy === "revise" ? "Fixing…" : "Fix with Milo"}
                    </Button>
                  </div>
                </Callout>
              ) : (
                !p.filed && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button onClick={() => run("review", "Run the strict reviewer")} disabled={!!busy}>
                      🧑‍⚖️ {busy === "review" ? "Reviewing…" : p.version > 1 ? "Review again" : "Run strict reviewer"}
                    </Button>
                    {p.fixed && p.fixed.length > 0 && <span className="text-sm text-success">Fixed {p.fixed.length} objections in v{p.version}.</span>}
                  </div>
                )
              )}
            </div>

            {p.diff && p.diff.length > 0 && (
              <div className="no-print mt-6">
                <h3 className="mb-2 text-sm font-medium text-muted">Changes in v{p.version}</h3>
                <div className="overflow-hidden rounded border border-border font-mono text-[13px]">
                  {p.diff.slice(0, 40).map((l, i) => (
                    <div key={i} className={`px-3 py-0.5 ${l.op === "add" ? "bg-success-soft" : "bg-danger-soft line-through decoration-[#b42323]/40"}`}>
                      <span aria-label={l.op === "add" ? "added" : "removed"}>{l.op === "add" ? "+ " : "− "}</span>
                      {l.text}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="no-print mt-8 flex flex-wrap gap-2">
              {!p.filed && c?.status !== "appeal_filed" && (
                <Button variant="primary" onClick={file}>
                  <ShieldCheck size={16} strokeWidth={1.75} aria-hidden /> Verify & file
                </Button>
              )}
              <Button onClick={() => window.print()}>
                <Printer size={16} strokeWidth={1.75} aria-hidden /> Download PDF
              </Button>
              <Button onClick={copyText}>
                <Copy size={16} strokeWidth={1.75} aria-hidden /> {copied ? "Copied" : "Copy text"}
              </Button>
            </div>
          </>
        )}
      </Section>
      <p className="mt-10 text-xs text-muted">
        Milo helps with paperwork. It is not medical or legal advice. Appeal letters are drafts for your clinician to review and sign. All data is fictional demo data.
      </p>
    </div>
  );
}
