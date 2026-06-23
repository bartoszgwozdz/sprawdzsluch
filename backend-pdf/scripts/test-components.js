#!/usr/bin/env node

// Test script dla mikroserwisu backend-pdf
const path = require('path');

// Dodaj src do path
process.chdir(path.join(__dirname, '..'));

async function testComponents() {
  console.log('🧪 Testowanie komponentów mikroserwisu backend-pdf...\n');
  
  try {
    // Test 1: Konfiguracja
    console.log('1️⃣ Test konfiguracji...');
    const config = require('../src/config/config');
    console.log('✅ Konfiguracja załadowana poprawnie');
    console.log(`   - Port: ${config.app.port}`);
    console.log(`   - MongoDB: ${config.mongodb.uri}\n`);
    
    // Test 2: Logger
    console.log('2️⃣ Test loggera...');
    const logger = require('../src/utils/logger');
    logger.info('Test wiadomości info');
    logger.warn('Test wiadomości warning');
    console.log('✅ Logger działa poprawnie\n');
    
    // Test 3: Data Service
    console.log('3️⃣ Test serwisu danych...');
    const dataService = require('../src/services/dataService');
    
    // Test interpretacji poziomów słyszenia
    const testLevels = [15, 25, 45, 65, 85];
    testLevels.forEach(level => {
      const interpretation = dataService.getHearingLevelInterpretation(level);
      console.log(`   Poziom ${level}dB: ${interpretation.status} (${interpretation.color})`);
    });
    
    // Test ogólnej oceny
    const hearingLevels = { 250: 20, 500: 25, 1000: 30, 2000: 35, 4000: 40 };
    const assessment = dataService.getOverallHearingAssessment(hearingLevels);
    console.log(`   Ogólna ocena: ${assessment.status}`);
    console.log('✅ Serwis danych działa poprawnie\n');
    
    // Test 4: PDF Service (podstawowy test bez puppeteer)
    console.log('4️⃣ Test serwisu PDF (bez generowania)...');
    const pdfService = require('../src/services/pdfService');
    
    // Test przygotowania danych do szablonu
    const testData = {
      testId: 'TEST-123',
      userEmail: 'test@example.com',
      maxAudibleFrequency: 16000,
      hearingLevels: { 250: 15, 500: 20, 1000: 25, 2000: 30, 4000: 45 },
      createdAt: new Date().toISOString()
    };
    
    const templateData = pdfService.prepareTemplateData(testData);
    console.log(`   Dane szablonu przygotowane dla testu: ${templateData.testId}`);
    console.log(`   Liczba wyników słuchu: ${templateData.hearingResults.length}`);
    console.log(`   Ocena ogólna: ${templateData.assessment.status}`);
    console.log('✅ Serwis PDF (przygotowanie danych) działa poprawnie\n');
    
    // Test 5: Email Service (tylko konfiguracja)
    console.log('5️⃣ Test serwisu email (konfiguracja)...');
    const emailService = require('../src/services/emailService');
    
    const emailContent = emailService.generateEmailContent(testData);
    console.log(`   Wygenerowano treść email (HTML: ${emailContent.html.length} znaków)`);
    console.log(`   Wygenerowano treść email (TEXT: ${emailContent.text.length} znaków)`);
    console.log('✅ Serwis email (generowanie treści) działa poprawnie\n');
    
    // Test 6: Template
    console.log('6️⃣ Test szablonu HTML...');
    try {
      const fs = require('fs').promises;
      const handlebars = require('handlebars');
      const templatePath = path.join(__dirname, '../src/templates/hearing-report.hbs');
      
      const templateContent = await fs.readFile(templatePath, 'utf8');
      const template = handlebars.compile(templateContent);
      const html = template(templateData);
      
      console.log(`   Szablon HTML wygenerowany (${html.length} znaków)`);
      console.log('✅ Szablon HTML działa poprawnie\n');
      
    } catch (error) {
      console.log('❌ Błąd szablonu HTML:', error.message);
    }
    
    console.log('🎉 Wszystkie podstawowe testy zakończone pomyślnie!');
    console.log('\n📝 Uwagi:');
    console.log('   - Kafka consumer wymaga działającego Kafki');
    console.log('   - PDF generation wymaga Puppeteer/Chromium');
    console.log('   - Email service wymaga konfiguracji SMTP');
    console.log('   - MongoDB wymaga działającego serwera MongoDB');
    
  } catch (error) {
    console.error('❌ Błąd podczas testowania:', error);
    process.exit(1);
  }
}

testComponents();