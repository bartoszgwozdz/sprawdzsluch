const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
  }
  
  async initializeTransporter() {
    if (!this.transporter) {
      try {
        const transportOptions = {
          host: config.email.smtp.host,
          port: config.email.smtp.port,
          secure: config.email.smtp.secure
        };

        // Dołącz auth tylko gdy podano poświadczenia — pozwala korzystać z lokalnego
        // serwera SMTP bez uwierzytelniania (np. Mailpit w środowisku e2e).
        if (config.email.smtp.auth.user) {
          transportOptions.auth = {
            user: config.email.smtp.auth.user,
            pass: config.email.smtp.auth.pass
          };
        }

        this.transporter = nodemailer.createTransport(transportOptions);
        
        // Weryfikacja połączenia
        await this.transporter.verify();
        logger.info('Połączenie SMTP zweryfikowane pomyślnie');
        
      } catch (error) {
        logger.error('Błąd podczas inicjalizacji transportera email:', error);
        throw error;
      }
    }
    return this.transporter;
  }
  
  async sendReportEmail(userEmail, pdfBuffer, testData) {
    try {
      logger.info(`Wysyłanie emaila z raportem do: ${userEmail}`);
      
      const transporter = await this.initializeTransporter();
      
      const emailContent = this.generateEmailContent(testData);
      
      const mailOptions = {
        from: config.email.from,
        to: userEmail,
        subject: config.email.subject,
        html: emailContent.html,
        text: emailContent.text,
        attachments: [
          {
            filename: `raport-sluch-${testData.testId}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      };
      
      const result = await transporter.sendMail(mailOptions);
      
      logger.info(`Email wysłany pomyślnie do ${userEmail}, messageId: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        recipient: userEmail
      };
      
    } catch (error) {
      logger.error(`Błąd podczas wysyłania emaila do ${userEmail}:`, error);
      throw error;
    }
  }
  
  generateEmailContent(testData) {
    const testDate = testData.createdAt ? 
      new Date(testData.createdAt).toLocaleDateString('pl-PL') : 
      new Date().toLocaleDateString('pl-PL');
    
    const html = `
      <!DOCTYPE html>
      <html lang="pl">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Twój raport z testu słuchu</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  max-width: 600px;
                  margin: 0 auto;
                  padding: 20px;
              }
              .header {
                  text-align: center;
                  background: #007bff;
                  color: white;
                  padding: 20px;
                  border-radius: 10px 10px 0 0;
              }
              .content {
                  background: #f8f9fa;
                  padding: 30px;
                  border-radius: 0 0 10px 10px;
              }
              .logo {
                  font-size: 2em;
                  font-weight: bold;
                  margin-bottom: 10px;
              }
              .highlight {
                  background: #e7f3ff;
                  padding: 15px;
                  border-left: 4px solid #007bff;
                  margin: 20px 0;
              }
              .button {
                  display: inline-block;
                  background: #007bff;
                  color: white !important;
                  padding: 12px 24px;
                  text-decoration: none;
                  border-radius: 5px;
                  margin: 10px 0;
              }
              .footer {
                  text-align: center;
                  margin-top: 30px;
                  padding: 20px;
                  border-top: 1px solid #ddd;
                  color: #666;
                  font-size: 0.9em;
              }
              .test-info {
                  background: white;
                  padding: 15px;
                  border-radius: 5px;
                  margin: 15px 0;
              }
          </style>
      </head>
      <body>
          <div class="header">
              <div class="logo">SprawdźSłuch</div>
              <p>Twój raport z testu słuchu jest gotowy!</p>
          </div>
          
          <div class="content">
              <h2>Cześć!</h2>
              
              <p>Dziękujemy za wykonanie testu słuchu w naszym serwisie <strong>SprawdźSłuch</strong>.</p>
              
              <div class="test-info">
                  <h3>Informacje o Twoim teście:</h3>
                  <ul>
                      <li><strong>Data badania:</strong> ${testDate}</li>
                      <li><strong>ID testu:</strong> ${testData.testId}</li>
                      <li><strong>Maksymalna słyszalna częstotliwość:</strong> ${testData.maxAudibleFrequency || 'Nie określono'} Hz</li>
                  </ul>
              </div>
              
              <div class="highlight">
                  <h3>📋 Twój szczegółowy raport</h3>
                  <p>W załączniku znajdziesz kompletny raport PDF z wynikami Twojego testu słuchu, 
                  zawierający szczegółową analizę oraz profesjonalne zalecenia.</p>
              </div>
              
              <h3>Co dalej?</h3>
              <ul>
                  <li>Zachowaj ten raport na przyszłość</li>
                  <li>W przypadku niepokojących wyników skonsultuj się z audiologiem</li>
                  <li>Regularne badania słuchu są zalecane co 2-3 lata</li>
              </ul>
              
              <div class="highlight">
                  <h4>⚠️ Ważne przypomnienie</h4>
                  <p>Ten test ma charakter orientacyjny i nie zastępuje profesjonalnej diagnozy medycznej. 
                  W przypadku problemów ze słuchem zalecamy konsultację z lekarzem specjalistą.</p>
              </div>
              
              <p>Jeśli masz pytania dotyczące wyników lub potrzebujesz dodatkowych informacji, 
              skontaktuj się z nami pod adresem: <a href="mailto:kontakt@sprawdzsluch.pl">kontakt@sprawdzsluch.pl</a></p>
              
              <p>Dziękujemy za zaufanie i dbaj o swój słuch! 👂</p>
              
              <p>Pozdrawiamy,<br>
              <strong>Zespół SprawdźSłuch</strong></p>
          </div>
          
          <div class="footer">
              <p><strong>SprawdźSłuch</strong> - Profesjonalny test słuchu online</p>
              <p>www.sprawdzsluch.pl | kontakt@sprawdzsluch.pl</p>
              <p>Ten email został wysłany automatycznie. Prosimy nie odpowiadać na tę wiadomość.</p>
          </div>
      </body>
      </html>
    `;
    
    const text = `
SprawdźSłuch - Twój raport z testu słuchu

Cześć!

Dziękujemy za wykonanie testu słuchu w naszym serwisie SprawdźSłuch.

Informacje o Twoim teście:
- Data badania: ${testDate}
- ID testu: ${testData.testId}
- Maksymalna słyszalna częstotliwość: ${testData.maxAudibleFrequency || 'Nie określono'} Hz

W załączniku znajdziesz kompletny raport PDF z wynikami Twojego testu słuchu.

WAŻNE: Ten test ma charakter orientacyjny i nie zastępuje profesjonalnej diagnozy medycznej.

Pozdrawiamy,
Zespół SprawdźSłuch
www.sprawdzsluch.pl
    `;
    
    return { html, text };
  }
  
  async sendTestEmail(recipient) {
    try {
      const transporter = await this.initializeTransporter();
      
      const mailOptions = {
        from: config.email.from,
        to: recipient,
        subject: 'Test połączenia - SprawdźSłuch PDF Service',
        html: '<h1>Test połączenia</h1><p>Email service działa poprawnie!</p>',
        text: 'Test połączenia - Email service działa poprawnie!'
      };
      
      const result = await transporter.sendMail(mailOptions);
      logger.info(`Test email wysłany do ${recipient}, messageId: ${result.messageId}`);
      
      return result;
      
    } catch (error) {
      logger.error('Błąd podczas wysyłania test emaila:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();