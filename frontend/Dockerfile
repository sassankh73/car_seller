FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install && \
    npm install --no-save "@next/swc-linux-arm64-gnu@14.2.0" 2>/dev/null || true

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
