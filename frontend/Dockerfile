FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install && \
    npm install --no-save "@next/swc-linux-arm64-gnu@14.2.0" 2>/dev/null || true

COPY . .

# Build the production bundle at image-build time. Running `next dev` in containers
# (the previous setup) compiles pages on-demand on first request, which is what made
# the dashboard hang/error and need a reload — `next build` + `next start` serves a
# pre-compiled, production-optimized app that responds immediately on first load.
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
