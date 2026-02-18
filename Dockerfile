FROM node:20-slim

# Install dependencies for Puppeteer/Chromium
RUN apt-get update \
  && apt-get install -y wget gnupg \
  && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
  && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
  && apt-get update \
  && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Config env to use installed chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# ========== Build Backend ==========
COPY package*.json ./
RUN npm install

COPY src/ ./src/
COPY prisma/ ./prisma/
COPY tsconfig.json ./

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# ========== Build Frontend ==========
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/

# Build frontend with API URL (same origin, no need for external URL)
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN cd frontend && npm run build

# Move frontend dist to where backend can serve it
RUN cp -r frontend/dist ./dist/public

# Expose port
EXPOSE 7860

# Start
CMD [ "npm", "start" ]
