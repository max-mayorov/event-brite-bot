FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci
RUN npx playwright install --with-deps chromium

COPY . .
RUN npm run build

CMD ["node", "dist/index.js"]
