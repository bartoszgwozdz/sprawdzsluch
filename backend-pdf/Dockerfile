# Stage 1: Build stage
FROM node:24-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev


# Stage 2: Production stage
FROM node:24-alpine

WORKDIR /app

# Install Chromium and dependencies for Alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    fontconfig

# Copy dependencies from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
COPY pdf-service.js ./

# Create a non-root user
RUN addgroup -S pdfuser && adduser -S -G pdfuser pdfuser \
    && chown -R pdfuser:pdfuser /app

# Set Puppeteer environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

USER pdfuser

EXPOSE 3000

CMD ["node", "pdf-service.js"]
