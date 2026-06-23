---
name: frontend-prod-smoke
description: 'Runs production smoke checks for frontend deployed on 213.199.63.237 using HTTP checks and Playwright MCP. Use after each deploy, hotfix, or incident.'
argument-hint: '<optional page paths, default />'
user-invocable: true
---

# Frontend Prod Smoke

Use this skill right after deployment to confirm that frontend is healthy.

## Procedure
1. HTTP health check:
   - `curl -I -sS --max-time 10 http://213.199.63.237`
   - If status is 5xx, fail fast and go to diagnostics.
2. Browser check with Playwright MCP:
   - Open `http://213.199.63.237`.
   - Confirm page renders and no blocking error banner is visible.
   - Capture screenshot for release evidence.
3. Console sanity:
   - Read browser console messages.
   - Fail if there are uncaught errors that break rendering.
4. Optional API path checks:
   - Probe key paths used by frontend, for example payment return page.
5. Output a short verdict:
   - PASS or FAIL.
   - HTTP status, major console errors, screenshot path.

## Diagnostics when FAIL
1. Check ingress and services:
   - `kubectl get ingressroute -n sprawdzsluch`
   - `kubectl get svc -n sprawdzsluch`
2. Check frontend pods:
   - `kubectl get pods -n sprawdzsluch -l app=frontend`
   - `kubectl logs -n sprawdzsluch deploy/frontend --tail=120`
3. Correlate with latest GitHub Actions run and failing step.
