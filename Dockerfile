FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

ENV PORT=3000
ENV HOST=0.0.0.0
ENV BEDROCK_MOCK=true
ENV SIMULATE_RING_DEVICE=true
ENV SIMULATE_ALEXA_SPEAKER=true

EXPOSE 3000
CMD ["node", "dist/server.js"]
