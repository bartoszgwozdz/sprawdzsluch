const path = require('path');
process.chdir(path.join(__dirname, '..'));
const pdfService = require('../src/services/pdfService');
const fs = require('fs');
const outPath = process.argv[2] || path.join(__dirname, '../../test-report.pdf');
const sample = {
  testId: 'HT-2026-0623-8842',
  userEmail: 'anna.kowalska@email.com',
  maxAudibleFrequency: 14000,
  hearingLevels: { 250: 10, 500: 15, 1000: 20, 2000: 30, 4000: 50, 8000: 65 },
  createdAt: new Date().toISOString(),
  payment: { method: 'PAYNOW', completedAt: new Date().toISOString(), paymentId: 'PN-7F3A91C2' }
};
(async () => {
  const buf = await pdfService.generateHearingTestReport(sample);
  fs.writeFileSync(outPath, buf);
  console.log('Wrote', outPath, buf.length, 'bytes');
  await pdfService.closeBrowser();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
