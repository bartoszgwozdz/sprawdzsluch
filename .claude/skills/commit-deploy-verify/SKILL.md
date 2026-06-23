---
name: commit-deploy-verify
description: 'Automates release flow for sprawdzsluch: git status, tests, commit, push to main, monitor GitHub Actions CI/CD, and verify production on 213.199.63.237. Use for deploy, release, hotfix, and post-merge verification.'
argument-hint: '<scope of change and short commit message>'
user-invocable: true
---

# Commit Deploy Verify

Use this skill when code changes should trigger GitHub Actions deployment automatically.

## Inputs
- Scope of change, for example: frontend, backend-core, k8s, observability.
- Commit message, for example: fix(frontend): improve payment summary rendering.

## Procedure
1. Validate local state:
   - Run `git status --short`.
   - If there are no changes, stop with an explicit message.
2. Run minimum quality gate based on changed paths:
   - `frontend/**` -> `cd frontend && npm ci && npm run build`.
   - `backend-core/**` -> `cd backend-core && ./mvnw -q test`.
   - `backend-payments/**` -> `cd backend-payments && ./mvnw -q test`.
   - `backend-pdf/**` -> `cd backend-pdf && npm ci && npm test --if-present`.
   - `k8s/**` -> `kubectl apply --dry-run=client -f` for changed manifests.
3. Commit and push:
   - `git add -A`
   - `git commit -m "<message>"`
   - `git push origin main`
4. Monitor deployment in GitHub Actions:
   - Use GitHub MCP tools to find the latest `CI/CD Pipeline` run.
   - Wait until status is `success` or `failure`.
   - If failure, extract failing job and first actionable error.
5. Verify production:
   - Check `http://213.199.63.237` (expect non-5xx and valid HTML).
   - For frontend changes, run additional browser smoke check (use `frontend-prod-smoke` skill).
6. Report:
   - Commit hash.
   - Workflow run status and URL.
   - Production smoke check result.
   - Next action if failed (rollback or targeted fix).

## Guardrails
- Never include secrets in commit messages, logs, or chat output.
- If push to `main` is blocked by branch protection, push current branch and create PR via GitHub MCP.
- If workflow fails at image deploy, suggest rollback to previous working commit using `git revert`.
