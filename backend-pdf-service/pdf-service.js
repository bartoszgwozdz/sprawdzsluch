// pdf-service.js (Node.js + Puppeteer)
const express = require('express');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const app = express();

// Konfiguracja logowania
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Prosta funkcja logująca
function log(level, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} [${level}] ${message}\n`;
  
  // Zapis do konsoli
  console.log(logMessage);
  
  // Zapis do pliku
  const logFile = path.join(logDir, 'pdf-service.log');
  fs.appendFileSync(logFile, logMessage);
  
  // Osobny plik dla błędów
  if (level === 'ERROR') {
    const errorFile = path.join(logDir, 'error.log');
    fs.appendFileSync(errorFile, logMessage);
  }
}

// Middleware
app.use(express.json({ limit: '10mb' }));

// Middleware logujący żądania
app.use((req, res, next) => {
  log('INFO', `${req.method} ${req.originalUrl} - ${req.ip}`);
  next();
});

app.post('/generate-pdf', async (req, res) => {
  try {
    const { html } = req.body;
    
    if (!html) {
      log('WARN', 'Brak treści HTML w żądaniu');
      return res.status(400).send('Brak wymaganej treści HTML');
    }
    
    log('INFO', 'Uruchamianie przeglądarki Puppeteer');
    
    // Konfiguracja z większą tolerancją na różne środowiska
    const launchOptions = { 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    };
    
    // Użyj ścieżki zdefiniowanej w zmiennych środowiskowych, jeśli istnieje
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      log('INFO', `Używam Chrome z: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }
    
    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();
    
    log('INFO', 'Renderowanie HTML');
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    log('INFO', 'Generowanie PDF');
    const pdfBuffer = await page.pdf({ format: 'A4' });
    await browser.close();
    
    log('INFO', 'PDF wygenerowany pomyślnie');
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (error) {
    log('ERROR', `Błąd podczas generowania PDF: ${error.message}`);
    res.status(500).send(`Błąd podczas generowania PDF: ${error.message}`);
  }
});

// Endpoint healthcheck
app.get('/health', (req, res) => {
  log('INFO', 'Sprawdzenie stanu usługi');
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  log('INFO', `PDF service uruchomiony na porcie ${PORT}`);
});
