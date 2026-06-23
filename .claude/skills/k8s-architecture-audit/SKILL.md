---
name: k8s-architecture-audit
description: 'Audits sprawdzsluch Kubernetes architecture for reliability, deployment speed, and observability. Use for optimization, 503/latency incidents, and pre-release hardening.'
argument-hint: '<focus: reliability|cost|performance|security|all>'
user-invocable: true
---

# K8s Architecture Audit

Use this skill to review architecture and produce prioritized optimization actions.

## Procedure
1. Read current deployment model:
   - GitHub Actions workflows in `.github/workflows/`.
   - Manifests in `k8s/` and observability stack.
2. Validate traffic path end-to-end:
   - IngressRoute -> Service name/port -> Deployment containerPort.
   - Flag mismatches that can produce 404/502/503.
3. Validate release strategy:
   - Check image tags (`latest` vs immutable tags by commit SHA).
   - Check rollout strategy and rollback readiness.
4. Validate probes and resources:
   - Ensure readiness/liveness/startup probes are realistic per service startup profile.
   - Compare requests/limits with HPA thresholds.
5. Validate security and reliability:
   - NetworkPolicy coverage.
   - Secret handling strategy.
   - PodDisruptionBudget and anti-affinity where needed.
6. Validate observability:
   - ServiceMonitor coverage for each service.
   - Log correlation fields and alert quality (actionable and low-noise).
7. Produce output with three sections:
   - Critical fixes (must do now).
   - High-impact improvements (next sprint).
   - Nice-to-have improvements (later).

## Output format
- Include exact file paths and concrete patch suggestions.
- Include expected impact and risk for each recommendation.
- Keep list sorted by severity.
