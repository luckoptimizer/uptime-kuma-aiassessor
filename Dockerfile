FROM node:18-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# Copy source and build the Vite frontend
COPY . .
RUN npm run build

# Render will set PORT (default 3001 locally)
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server/server.js"]
