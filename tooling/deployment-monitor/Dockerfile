FROM node:24.17.0-slim
WORKDIR /app
COPY package.json collector.mjs google.mjs server.mjs jest-provider.mjs index.html seed.json ./
USER node
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
