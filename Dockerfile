# 다크넷 커뮤니티 — 외부 패키지 없이 Node만 있으면 돌아간다
FROM node:22-alpine
WORKDIR /app
COPY package.json server.js seed.js ./
COPY public ./public
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    TRUST_PROXY=1
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
