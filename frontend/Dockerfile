FROM node:20

WORKDIR /app

# Copy pre-built output from host.
# Run `npm run build` in frontend/ on your Mac before building this image.
# The .next/ build output and node_modules are copied in directly — no npm
# network access required inside the container.
COPY . .

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
