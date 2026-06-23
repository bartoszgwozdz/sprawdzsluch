# backend-pdf — środowisko testów e2e

Lokalne środowisko, które testuje **pełną ścieżkę produktu** serwisu `backend-pdf`,
łącznie z faktyczną wysyłką maila:

```
seed hearing_results (MongoDB)
  → POST /api/v1/payment-completed   (działający serwis backend-pdf)
    → generowanie PDF (Puppeteer)
      → wysyłka maila (SMTP → Mailpit)
        → asercje: mail dotarł, poprawny odbiorca, załącznik to prawdziwy PDF
```

## Składniki

| Element | Rola | Port |
|---|---|---|
| **MongoDB** (docker) | `hearing_results`, `processed_pdf_events` | `27018` → 27017 |
| **Mailpit** (docker) | przechwytuje wychodzące maile, API + UI | SMTP `1025`, UI `8025` |
| **backend-pdf** (node, lokalnie) | testowany kod z repo | `3001` |

Mailpit łapie maile bez prawdziwego wysyłania — możesz je obejrzeć w przeglądarce
pod **http://localhost:8025**.

## Wymagania
- Docker z pluginem `compose`
- Node ≥ 18
- `npm install` w katalogu `backend-pdf/`

## Uruchomienie

```bash
cd backend-pdf
npm run test:e2e
```

Skrypt sam: podnosi kontenery, startuje serwis, czeka na `/health`, uruchamia test
i **sprząta** (zatrzymuje serwis, usuwa kontenery) — również po błędzie.

### Warianty

```bash
# zostaw infrastrukturę po teście (np. by obejrzeć maile w UI Mailpit)
KEEP_UP=1 npm run test:e2e

# ręcznie: sama infrastruktura
docker compose -f test/e2e/docker-compose.yml up -d
docker compose -f test/e2e/docker-compose.yml down -v
```

### Uruchomienie samego testu przeciw już działającemu serwisowi
```bash
MONGODB_URI=mongodb://localhost:27018/sprawdzsluch \
PDF_BASE_URL=http://localhost:3001 \
MAILPIT_URL=http://localhost:8025 \
node test/e2e/e2e.test.js
```

## Pliki
- `docker-compose.yml` — MongoDB + Mailpit (baza w tmpfs, czysty stan za każdym razem)
- `.env.e2e` — konfiguracja serwisu na czas testu (SMTP → Mailpit, Mongo → :27018)
- `run-e2e.sh` — orkiestrator całego cyklu
- `e2e.test.js` — właściwy test (asercje), działa na czystym `node` (global `fetch`)

## Uwaga
Test używa unikalnego `testId`/emaila per uruchomienie, więc nie wpada w guard
idempotencji i nie koliduje z poprzednimi przebiegami.
