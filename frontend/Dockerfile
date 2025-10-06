# ETAP 1: Budowanie (Node.js environment)
FROM node:18-alpine AS builder

# Ustaw katalog roboczy
WORKDIR /app

# Skopiuj package.json i build.js
COPY package.json build.js ./

# Skopiuj kod źródłowy
COPY src ./src

# Zainstaluj zależności
RUN npm install

# Uruchom build.js (obfuskacja i minifikacja)
RUN npm run obf:build

# ETAP 2: Nginx (produkcyjny obraz)
FROM nginx:alpine

# Skopiuj zbudowane i obfuskatowane pliki z etapu 1
COPY --from=builder /app/src /usr/share/nginx/html

# Skopiuj konfigurację nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Port
EXPOSE 80

# Uruchom nginx
CMD ["nginx", "-g", "daemon off;"]

