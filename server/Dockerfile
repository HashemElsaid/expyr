# Node 24 runs TypeScript directly, so there is no build step.
FROM node:24-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8787
EXPOSE 8787

CMD ["node", "index.ts"]
