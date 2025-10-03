# filepath: /Users/bgwozdz/IdeaProjects/pdf-service/Dockerfile
# Bardziej stabilne podejście z chromium-browser
FROM node:24.8-slim

WORKDIR /app

# Instalacja Chromium i zależności
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf \
    ca-certificates \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libasound2 && \
    rm -rf /var/lib/apt/lists/*

# Kopiowanie plików projektu
COPY package*.json ./

# Instalacja zależności
RUN npm install --omit=dev

# Kopiowanie kodu aplikacji
COPY pdf-service.js ./

# Utworzenie katalogu na logi
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Konfiguracja Puppeteer do używania zainstalowanego Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Użytkownik bez uprawnień roota
RUN groupadd -r pdfuser && useradd -r -g pdfuser -s /bin/false pdfuser \
    && chown -R pdfuser:pdfuser /app
USER pdfuser

# Ustawienie portu
EXPOSE 3000

# Uruchomienie aplikacji
CMD ["node", "pdf-service.js"]