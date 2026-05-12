# ======== Stage 1: Build ========
FROM node:20-slim AS builder

WORKDIR /app

# Build Backend
COPY package*.json ./
RUN npm install

COPY src/ ./src/
COPY prisma/ ./prisma/
COPY tsconfig.json ./

RUN npx prisma generate
RUN npm run build

# Build Frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/

ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN cd frontend && npm run build

# Move frontend dist
RUN cp -r frontend/dist ./dist/public

# ======== Stage 2: Runtime ========
FROM node:20-slim

# Install Chrome (for attendance auto-click only)
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
  && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
ENV DBUS_SESSION_BUS_ADDRESS=/dev/null

WORKDIR /app

# Copy only production dependencies and built files from builder
COPY --from=builder /app/package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist/
COPY --from=builder /app/prisma ./prisma/
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

RUN npx prisma generate

EXPOSE 7860
CMD [ "npm", "start" ]
