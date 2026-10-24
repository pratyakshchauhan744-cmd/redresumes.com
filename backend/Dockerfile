
# ============================================
# STAGE 1: Install Node.js dependencies
# ============================================
FROM node:22-alpine AS deps

WORKDIR /app

# Use system Chromium instead of downloading Chrome
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./

RUN npm ci


# ============================================
# STAGE 2: Build TypeScript backend
# ============================================
FROM node:22-alpine AS build

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and compile backend
RUN npm run prisma:generate && npm run build


# ============================================
# STAGE 3: Production runtime
# ============================================
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Install Chromium and its required libraries
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Configure Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Verify Chromium exists
RUN test -x /usr/bin/chromium-browser && \
    chromium-browser --version

# Copy application dependencies and compiled code
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

COPY package*.json ./

EXPOSE 4000

CMD ["node", "dist/src/main.js"]
