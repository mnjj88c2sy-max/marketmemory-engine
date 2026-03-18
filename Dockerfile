# Immagine ufficiale Puppeteer — Node 20 + Chromium già installati
# npm install scarica solo puppeteer-core (~5MB), zero download Chromium
FROM ghcr.io/puppeteer/puppeteer:20.9.0

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /home/pptruser/app

COPY package.json ./
RUN npm install

COPY keeper.js ./

CMD ["node", "keeper.js"]
