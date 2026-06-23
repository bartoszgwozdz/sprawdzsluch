---
name: app-analysis
description: 'Analyzes the SprawdźSłuch microservices/k8s hearing-test app end-to-end (architecture, product flow test→payment→PDF→email, reliability, security, RODO). ALWAYS reads the previous analysis at docs/ANALYSIS.md first to diff against prior findings, then refreshes the report and appends a dated history entry. Use for architecture review, health check, pre-release audit, or "analyze the application".'
argument-hint: '<optional focus: architecture|reliability|security|payments|pdf|all (default all)>'
user-invocable: true
---

# App Analysis (read-prior-then-reanalyze)

Use this skill to (re)analyze the SprawdźSłuch application. The defining behavior:
**you must read the previous analysis result before producing a new one**, so each run
is a diff against the last, not a cold start.

## Canonical result file
`docs/ANALYSIS.md` — single living document. It contains the current analysis body plus
an **Analysis History** section with one dated entry per run. Never delete history.

## Procedure

### 1. Load prior analysis (mandatory first step)
- Read `docs/ANALYSIS.md` in full.
  - If it is **missing**, state that this is the first/baseline run and create it at the end.
  - If it **exists**, note the `Last analyzed` date + commit and the prior findings list.
    You will compare against these.
- Capture current repo state for the diff:
  - `git rev-parse --short HEAD` and `git branch --show-current`
  - `git log --oneline -10`

### 2. Re-analyze the application
Scope to the user's focus argument if given (architecture | reliability | security |
payments | pdf | all). Inspect at least:
- **Services:** `backend-core/` (Spring), `backend-payments/` (Spring, handlers +
  factory + VoucherService), `backend-pdf/` (Express: index, paymentEventHandler,
  pdfService, dataService, emailService, config), `frontend/`.
- **Product flow:** trace test submit → `ResultService` → `PaymentNotificationService`
  → `PaymentController/PaymentService` → handler → `/api/v1/payment-completed` →
  `paymentEventHandler` → `pdfService` → `emailService`. Confirm it still produces a
  report and emails it to the customer.
- **Orchestration:** `k8s/` deployments/services/ingress/autoscaling, `.github/workflows/`,
  and the `observability-stack` working dir (OTel/Prometheus/Loki/Grafana).
- **Data model & idempotency:** entities, compound unique indexes, `processed_pdf_events`,
  deterministic `testId`.

For each area produce findings tagged by severity (🔴 critical / 🟠 reliability /
🟡 security/compliance / 🟢 quality). Prefer concrete `file:line`-level evidence.

### 3. Diff against prior findings
Explicitly classify each finding as:
- **NEW** — not in the previous analysis.
- **RESOLVED** — was in the previous analysis, now fixed (verify in code, don't assume).
- **STILL OPEN** — unchanged.
- **REGRESSED / CHANGED** — previously resolved but back, or materially changed.

### 4. Update the result file
- Refresh the body of `docs/ANALYSIS.md` (architecture, flow, findings, recommendations)
  to reflect current reality.
- Update the metadata header (`Last analyzed`, branch, commit).
- **Append** a new dated entry to **Analysis History** summarizing this run and the diff
  (NEW / RESOLVED / STILL OPEN). Do not remove earlier entries.

### 5. Report to the user
Give a concise summary: top findings, what changed since last run (the diff), and the
3–5 highest-leverage next actions. Point them at `docs/ANALYSIS.md` for the full report.

## Notes
- This is a read/analyze/document skill — do **not** change application code unless the
  user explicitly asks; only `docs/ANALYSIS.md` is written by default.
- Keep findings honest: verify "resolved" items in the actual code before crediting a fix.
