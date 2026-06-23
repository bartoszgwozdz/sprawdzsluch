#!/usr/bin/env node
/**
 * Test e2e backend-pdf: pełna ścieżka produktu.
 *
 *   seed hearing_results (MongoDB)
 *     -> POST /api/v1/payment-completed (działający serwis backend-pdf)
 *       -> generowanie PDF (Puppeteer)
 *         -> wysyłka maila (SMTP -> Mailpit)
 *           -> weryfikacja: mail dotarł, ma poprawnego odbiorcę i załącznik PDF
 *
 * Wymaga uruchomionej infrastruktury (docker-compose.yml) oraz działającego
 * serwisu backend-pdf. Najprościej odpalić przez ./run-e2e.sh, które ogarnia całość.
 *
 * Konfiguracja przez ENV (z wartościami domyślnymi dla lokalnego compose):
 *   MONGODB_URI   mongodb://localhost:27018/sprawdzsluch
 *   PDF_BASE_URL  http://localhost:3001
 *   MAILPIT_URL   http://localhost:8025
 */
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27018/sprawdzsluch';
const PDF_BASE_URL = process.env.PDF_BASE_URL || 'http://localhost:3001';
const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';

const runId = Date.now().toString(36);
const testId = `E2E-${runId}`;
const userEmail = `e2e-${runId}@example.com`;

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error(`❌ ASSERT: ${msg}`);
  passed++;
  console.log(`   ✅ ${msg}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poll(fn, { tries = 20, interval = 500, label = 'warunek' } = {}) {
  for (let i = 0; i < tries; i++) {
    const result = await fn();
    if (result) return result;
    await sleep(interval);
  }
  throw new Error(`Timeout czekając na: ${label}`);
}

async function main() {
  console.log(`🧪 e2e backend-pdf — testId=${testId} email=${userEmail}\n`);
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db();

  try {
    // 0) Czysty mailbox Mailpit
    await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });

    // 1) Seed wyniku testu w MongoDB (tak jak zapisałby go backend-core)
    console.log('1️⃣ Seeduję hearing_results...');
    await db.collection('hearing_results').insertOne({
      testId,
      userEmail,
      maxAudibleFrequency: 16000,
      hearingLevels: { 250: 15, 500: 20, 1000: 25, 2000: 30, 4000: 45, 8000: 60 },
      status: 'NEW',
      createdAt: new Date()
    });
    assert(true, 'wynik testu zapisany w MongoDB');

    // 2) Wywołaj endpoint payment-completed (jak backend-payments)
    console.log('2️⃣ POST /api/v1/payment-completed...');
    const res = await fetch(`${PDF_BASE_URL}/api/v1/payment-completed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': `e2e-${runId}` },
      body: JSON.stringify({
        testId,
        userEmail,
        paymentId: `PAY-${runId}`,
        paymentMethod: 'VOUCHER',
        completedAt: new Date().toISOString()
      })
    });
    const body = await res.json();
    assert(res.status === 200, `HTTP 200 (otrzymano ${res.status})`);
    assert(body.success === true, 'odpowiedź success=true');

    // 3) Weryfikacja maila w Mailpit
    console.log('3️⃣ Sprawdzam Mailpit...');
    const message = await poll(async () => {
      const r = await fetch(`${MAILPIT_URL}/api/v1/messages`);
      const data = await r.json();
      return (data.messages || []).find((m) =>
        (m.To || []).some((t) => t.Address === userEmail));
    }, { label: 'mail w Mailpit', tries: 20, interval: 500 });
    assert(!!message, `mail dostarczony do ${userEmail}`);

    const detailRes = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}`);
    const detail = await detailRes.json();
    assert(/raport/i.test(detail.Subject), `temat maila zawiera "raport" (${detail.Subject})`);

    const attachments = detail.Attachments || [];
    const pdf = attachments.find((a) => a.FileName === `raport-sluch-${testId}.pdf`);
    assert(!!pdf, `załącznik PDF obecny (raport-sluch-${testId}.pdf)`);
    assert(/pdf/i.test(pdf.ContentType), `typ załącznika to PDF (${pdf.ContentType})`);

    // 4) Zawartość załącznika to prawdziwy PDF (magic bytes %PDF)
    const partRes = await fetch(`${MAILPIT_URL}/api/v1/message/${message.ID}/part/${pdf.PartID}`);
    const buf = Buffer.from(await partRes.arrayBuffer());
    assert(buf.subarray(0, 4).toString() === '%PDF', `załącznik zaczyna się od %PDF (rozmiar ${buf.length}B)`);

    // 5) Idempotencja — marker zapisany w MongoDB
    const marker = await db.collection('processed_pdf_events').findOne({ testId });
    assert(!!marker, 'marker idempotencji zapisany w processed_pdf_events');

    console.log(`\n🎉 e2e OK — ${passed} asercji przeszło.`);
  } finally {
    // Sprzątanie danych testowych
    await db.collection('hearing_results').deleteOne({ testId }).catch(() => {});
    await db.collection('processed_pdf_events').deleteOne({ testId }).catch(() => {});
    await client.close();
  }
}

main().catch((err) => {
  console.error(`\n💥 e2e FAILED: ${err.message}`);
  process.exit(1);
});
