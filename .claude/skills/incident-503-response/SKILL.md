---
name: incident-503-response
description: 'Runs end-to-end diagnosis for HTTP 503 on sprawdzsluch production (213.199.63.237): ingress, services, pods, rollout history, and immediate mitigation steps. Use during outage or degraded frontend availability.'
argument-hint: '<optional path, default />'
user-invocable: true
---

# Incident 503 Response

Use this skill when frontend or API returns HTTP 503 in production.

## Procedure
1. Confirm incident scope:
   - `curl -I -sS --max-time 10 http://213.199.63.237`
   - Optional: check specific path passed by user.
2. Check entry layer:
   - `kubectl get ingressroute -n sprawdzsluch`
   - `kubectl describe ingressroute sprawdzsluch-frontend -n sprawdzsluch`
3. Validate service endpoints:
   - `kubectl get svc -n sprawdzsluch`
   - `kubectl get endpoints -n sprawdzsluch`
4. Validate workload health:
   - `kubectl get pods -n sprawdzsluch -o wide`
   - `kubectl describe pod <failing-pod> -n sprawdzsluch`
5. Check recent deploy impact:
   - `kubectl rollout history deployment/frontend -n sprawdzsluch`
   - Correlate with latest GitHub Actions run.
6. Check logs:
   - `kubectl logs -n sprawdzsluch deploy/frontend --tail=200`
   - `kubectl logs -n sprawdzsluch deploy/backend-core --tail=200`
7. Suggest immediate mitigation:
   - Rollback deployment to previous revision if outage started after deploy.
   - Apply targeted ingress/service fix if routing mismatch is detected.

## Output
- Root cause hypothesis ranked by confidence.
- Exact command(s) executed.
- Suggested mitigation and verification steps.
