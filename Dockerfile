FROM ghcr.io/puppeteer/puppeteer:21.0.0

# Puppeteer image già include Node 18 + Chromium + tutte le dipendenze
# Non serve installare nulla

WORKDIR /app

COPY package.json ./
RUN npm install

COPY keeper.js ./

CMD ["node", "keeper.js"]
