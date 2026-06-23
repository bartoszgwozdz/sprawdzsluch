# SprawdźSłuch — Application Analysis

> **Canonical analysis document.** The `app-analysis` Claude skill reads this file
> *before* every new analysis run, so it can diff against prior findings instead of
> starting from scratch. Each run appends a new dated entry under
> **Analysis History** and refreshes the body. Do not delete history entries.

- **Repo:** `sprawdzsluch` (monorepo)
- **Product:** Online hearing-test website that produces a PDF result report and emails it to the customer after payment.
- **Last analyzed:** 2026-06-23
- **Analyzed branch:** `ui-improvements`
- **Analyzed commit:** `e2e306c Hide secrets, improve flow, add immutability`

---

## 1. Purpose & Product Flow

SprawdźSłuch ("CheckHearing", Polish) lets a user run a browser-based hearing test,
pay a small fee, and receive a **PDF report by email**. The end-to-end product flow:

```
User (browser)
  │  runs audio test → collects hearingLevels{freq:dB} + maxAudibleFrequency + email + paymentMethod
  ▼
frontend (Nginx static)  ──POST /api/hearing-test/submit──►  backend-core
  │                          (alias → /api/results/submit)
  ▼
backend-core (Spring Boot)
  • validates email / payment method / hearing levels
  • generates deterministic testId (UUIDv3 of email|maxFreq|sorted levels)
  • saves TestResult → MongoDB (hearing_results)
  • writes TestProcessingStatus (SUBMITTED→PROCESSING→COMPLETED/ERROR)
  │  POST /api/payments/process (HTTP, sync)
  ▼
backend-payments (Spring Boot)
  • creates Payment (PENDING) → MongoDB (payments)
  • PaymentHandlerFactory picks handler by method:
      VOUCHER  → validate code, amount 0.00, COMPLETED if valid
      CARD/CARD_SANDBOX → amount 50.00, COMPLETED (sandbox stub)
      PAYU     → amount 50.00, PENDING (TODO: real API)
  • on COMPLETED → POST /api/v1/payment-completed
  │
  ▼
backend-pdf (Node/Express)
  • idempotency guard (processed_pdf_events unique index)
  • loads TestResult from MongoDB
  • renders Handlebars template → Puppeteer → PDF buffer
  • emails report (nodemailer) to userEmail
```

The browser polls `GET /api/hearing-test/status/{testId}` for progress.

---

## 2. Architecture

### Microservices
| Service | Stack | Port | Role |
|---|---|---|---|
| `frontend` | Nginx + static build (custom `build.js`) | 80 | UI, test runner, partials |
| `backend-core` | Spring Boot (Java 25) | 8090 | Ingest results, orchestrate, status |
| `backend-payments` | Spring Boot (Java 25) | 8082 (prod) / 8091 (dev) | Payment processing, handlers |
| `backend-pdf` | Node.js / Express | 3001 | PDF generation + email |

### Infrastructure (k8s, namespace `sprawdzsluch`)
- **MongoDB** (StatefulSet) — shared DB, collections `hearing_results`, `payments`, `processed_pdf_events`.
- **Kafka** (StatefulSet) + **kafka-ui** — **present but unused** (see findings).
- **Traefik** — IngressController, path routing + middlewares (rewrite, headers, rate-limit).
- **mongo-express**, **kafka-ui** — admin tooling.
- **HPA** for `backend-payments` (2–10) and `backend-pdf` (1–3). None for `backend-core`/`frontend`.
- **Observability stack** (separate repo `observability-stack`): OpenTelemetry Collector, Prometheus ServiceMonitors, Loki + Fluent Bit, Grafana dashboards (java/mongo/overview), mongodb-exporter, alert rules.

### Routing (Traefik IngressRoutes)
- `/` → frontend (priority 1)
- `/api/results` → backend-core; `/api/hearing-test/*` → rewrite → `/api/results/*`
- `/api/payments` → backend-payments; `/api/v1/payments/*` → rewrite → `/api/payments/*`
- `/api/v1/pdf`, `/api/v1/email`, `/health` → backend-pdf
- Per-route rate limits (core 100/m, payments 50/m, pdf 30/m), CORS `*`.

### Deployment / CI-CD
- GitHub Actions (`ci-cd.yaml`) on push to `main`, **self-hosted runner**.
- Builds all 4 images → local Docker registry `localhost:5000`, tags `:${sha}` **and** `:latest`.
- Applies manifests, waits for rollouts. Production host hardcoded `213.199.63.237` (HTTP).
- `infrastructure.yaml` — separate infra workflow.

---

## 3. Findings (prioritized)

### 🔴 Critical / Correctness
1. **Broken email sending** — ✅ **RESOLVED (2026-06-23).**
   `backend-pdf/src/services/emailService.js` called `nodemailer.createTransporter(...)`;
   the real API is `createTransport` (no "er"), so **every report email threw** at runtime.
   Fixed by renaming to `createTransport` and making `auth` optional when no SMTP
   credentials are set. Verified end-to-end via the new e2e env (`backend-pdf/test/e2e/`):
   PDF generated (324 KB) and email delivered to a Mailpit catch-all with a valid `%PDF`
   attachment.
2. **Inconsistent pricing across the system** — frontend advertises **24,99 zł**;
   `TestResultStoredEvent.getAmount()` hardcodes **24.99**; `CardHandler`/`PayuHandler`
   set **50.00**; `VoucherHandler` sets **0.00**. backend-core never sends an amount at
   all (`PaymentNotificationService` payload omits it). Pricing is not single-sourced.
3. **Vouchers are infinitely reusable** — `VoucherService` has a single hardcoded code
   (`REKRUTACJA`), uses `System.out.println` instead of the logger, and
   `deactivateVoucher` is a no-op TODO. Any user can self-serve free reports forever.

### 🟠 Reliability / Architecture
4. **Fully synchronous blocking chain** core→payments→pdf→email. PDF (Puppeteer) +
   SMTP are slow/fragile; the original request thread blocks through all of it. A slow
   SMTP server stalls the whole pipeline. Kafka is deployed but the code was migrated to
   synchronous HTTP ("zamiennik Kafka") — the async/retry safety net was removed while
   the infra cost remains.
5. **Partial-failure state** — if PDF/email fails, `Payment.paymentStatus=COMPLETED`
   but `pdfSent=false`; recovery is manual only (no retry/DLQ/scheduler). Customer paid,
   no report.
6. **`backend-core` lacks probes & resource limits** — unlike payments/pdf it has no
   liveness/readiness probes and no CPU/memory requests/limits; `replicas: 1`, no HPA.
   Single point of failure for ingest.
7. **Dead/unused Kafka infra** — StatefulSet, service, kafka-ui, create-topics all still
   deployed and documented though no service produces/consumes. Cost + confusion.

### 🟡 Security / Compliance
8. **No TLS** — ingress is HTTP-only; PayNow `redirectUrl`/`notifyUrl` and the prod host
   are `http://213.199.63.237`. Payment redirects and health data travel in clear text.
9. **CORS wide open** — `Access-Control-Allow-Origin: *` on all API responses.
10. **Health/PII data without retention policy** — email + hearing levels (health-related)
    stored indefinitely in MongoDB. For a Polish medical-adjacent service this raises
    RODO/GDPR obligations (retention, erasure, lawful basis). No anonymization/TTL.
11. **Hardcoded prod IP & infra coupling** — `213.199.63.237` baked into manifests and
    skills; no DNS/hostname indirection.

### 🟢 Quality / Maintainability
12. **Frontend↔backend endpoint drift** — several frontend blocks call
    `/api/payments/create`, which does **not** exist (`PaymentController` exposes only
    `/process` and `/status/{testId}`). Most appear inside commented-out `<script>`
    blocks (e.g. `test-sluchu/index.html`), but this is live confusion / dead code.
13. **CI has no test gate** — pipeline builds & deploys images but never runs `mvn test`
    / npm tests before rollout. Deployments still pull `:latest` (immutability only
    partial despite SHA tags being pushed). No rollback step.
14. **Validation ordering / gaps** — `maxAudibleFrequency` range check (1000–20000) lives
    in `convertToTestResult`, after `generateTestId` already ran; mixed Polish/English
    error messages; logging mixes `System.out.println` with SLF4J.
15. **Mixed-language codebase** — comments/logs/messages switch between Polish and English
    throughout; fine for a solo project but raises onboarding cost.

---

## 4. Strengths
- Clean separation of concerns; payment handlers use a clean Strategy + Factory pattern.
- **Idempotency** is handled at three layers: deterministic `testId`, unique compound
  indexes (`testId`+`userEmail`), and a `processed_pdf_events` guard in pdf.
- Correlation-ID propagation (`X-Correlation-Id` + MDC) across services for tracing.
- Real observability stack (OTel, Prometheus, Loki, Grafana) wired up separately.
- Reasonable test coverage on the payments domain (handlers, services, integration ITs).
- Sensible HPA + Puppeteer-tuned resources/securityContext on `backend-pdf`.
- Good operator docs (`k8s/README.md`) and existing operational skills under `.github/skills/`.

---

## 5. Recommended Next Actions (highest leverage first)
1. Fix `createTransport` typo — restores the product's email delivery. *(trivial, critical)*
2. Single-source the price and pass `amount` from core → payments → persisted Payment.
3. Make voucher use persistent + single-use (DB-backed), and replace `System.out`.
4. Add an outbox/queue or retry+scheduler for the payment→pdf→email step (reuse the
   already-deployed Kafka, or drop Kafka and add a DB-backed retry job).
5. Add probes + resource limits + HPA to `backend-core`.
6. Add a `mvn test` / npm test gate to CI before deploy; pin deployments to `:${sha}`.
7. Introduce TLS (Traefik + cert-manager/Let's Encrypt) and tighten CORS to the real origin.
8. Define a data-retention/erasure policy for hearing results (RODO).
9. Remove unused Kafka infra *or* re-introduce it as the async backbone (pick one).

---

## Analysis History

### 2026-06-23 — fix: email delivery + e2e env
**RESOLVED #1 (broken email):** `createTransporter` → `createTransport` in
`emailService.js`; `auth` now omitted when no credentials are configured. Added a local
e2e environment under `backend-pdf/test/e2e/` (MongoDB + Mailpit via docker-compose,
service run locally) exercising seed → `payment-completed` → PDF → email → assertions.
Run with `npm run test:e2e`. Also fixed a crash in `scripts/test-components.js`
(stale `config.kafka` reference). Still open: #2–#15.

### 2026-06-23 — initial baseline (commit `e2e306c`, branch `ui-improvements`)
First full analysis. Established architecture map and product flow. Top findings:
broken `createTransport` (email), inconsistent pricing (24.99 vs 50.00 vs frontend),
reusable hardcoded voucher, fully-synchronous fragile pipeline with no retry, unused
Kafka infra, backend-core missing probes/limits, HTTP-only/no-TLS, no CI test gate,
RODO retention gap. No regressions to compare against (baseline run).
