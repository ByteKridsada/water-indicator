# build context คือ root ของ repo เพราะ migrate ต้องอ่าน db/schema.sql และ db/seed.sql
FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY db ./db

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "src/index.js"]
