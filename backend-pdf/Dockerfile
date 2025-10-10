# Dockerfile dla backend-pdf mikroserwisu - SprawdźSłuch
FROM node:24.8-slim

# Metadane
LABEL maintainer="sprawdzsluch"
LABEL description="Mikroserwis do generowania PDF i wysyłki maili dla aplikacji sprawdzsluch"

WORKDIR /app

# Instalacja Chromium i zależności systemowych
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
    libxkbcomposite0 \
    libxrandr2 \
    xdg-utils \
    libasound2 && \
    rm -rf /var/lib/apt/lists/*

# Tworzenie użytkownika aplikacji
RUN groupadd -r pptruser && useradd -r -g pptruser -G audio,video pptruser \
    && mkdir -p /home/pptruser/Downloads \
    && chown -R pptruser:pptruser /home/pptruser \
    && chown -R pptruser:pptruser /app

# Kopiowanie plików projektu
COPY package*.json ./

# Instalacja zależności npm
RUN npm install --omit=dev

# Kopiowanie kodu aplikacji
COPY src/ ./src/
COPY .env.example ./.env

# Utworzenie katalogów na logi i dane tymczasowe
RUN mkdir -p /app/logs && mkdir -p /app/temp && \
    chown -R pptruser:pptruser /app/logs && \
    chown -R pptruser:pptruser /app/temp

# Konfiguracja Puppeteer do używania zainstalowanego Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Użytkownik bez uprawnień roota
USER pptruser

# Port na którym działa aplikacja
EXPOSE 3001

# Sprawdzenie stanu aplikacji
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Uruchomienie aplikacji
CMD ["npm", "start"]