# Socket.IO server untuk Hugging Face Spaces (Docker SDK).
# HF Spaces expose port 7860 dan menjalankan container sebagai user non-root.
FROM node:22-slim

USER node
WORKDIR /home/node/app

COPY --chown=node package.json package-lock.json ./
RUN npm ci

COPY --chown=node tsconfig.json ./
COPY --chown=node server ./server
COPY --chown=node src/lib ./src/lib

# server membaca SOCKET_PORT; WEB_ORIGIN (domain Vercel) di-set lewat
# Space Settings → Variables, bukan di sini
ENV SOCKET_PORT=7860
EXPOSE 7860

CMD ["npx", "tsx", "server/index.ts"]
