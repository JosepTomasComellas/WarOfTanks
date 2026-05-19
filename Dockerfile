FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --omit=dev

# Copy source (el .dockerignore exclou node_modules, .git, etc.)
COPY . .

# Environment defaults (overridden via docker run -e or .env)
ENV NODE_ENV=production \
    ROLE=client \
    SERVER_IP=localhost \
    UDP_PORT=8888 \
    HTTP_PORT=8080

# Web interface port (HTTP + WebSocket)
EXPOSE 8080
# Game server UDP port (only used when ROLE=server)
EXPOSE 8888/udp

CMD ["node", "entrypoint.js"]
