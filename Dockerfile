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
    HTTP_PORT=8888 \
    HTTPS_ENABLED=false \
    SSL_CERT=/certs/cert.pem \
    SSL_KEY=/certs/key.pem \
    WALL_DENSITY=20 \
    MAX_TABS=1 \
    LOGO_URL= \
    ADMIN_PASSWORD=

EXPOSE 8888
EXPOSE 8888/udp

CMD ["node", "entrypoint.js"]
