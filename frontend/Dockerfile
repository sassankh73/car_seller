FROM node:20

WORKDIR /app

COPY . .

# Standalone server needs static assets and public folder alongside it
RUN cp -r .next/static .next/standalone/.next/static && \
    cp -r public .next/standalone/public

EXPOSE 3000

CMD ["node", ".next/standalone/server.js"]
