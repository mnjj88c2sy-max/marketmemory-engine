// MarketMemory — Railway Keeper v3
// Usa puppeteer-core + Chromium di sistema (no download ~170MB)

const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');

const APP_URL      = process.env.MM_URL            || 'https://YOUR-APP.netlify.app';
const RELOAD_EVERY = parseInt(process.env.RELOAD_EVERY_MIN || '120') * 60 * 1000;
const CHECK_EVERY  = parseInt(process.env.CHECK_EVERY_MIN  || '5')   * 60 * 1000;
const TZ           = process.env.TZ || 'Europe/Rome';

function ts() {
  return new Date().toLocaleString('it-IT', { timeZone: TZ });
}
function log(msg) { console.log(`[${ts()}] ${msg}`); }

// Trova Chromium installato nel sistema
function findChromium() {
  const paths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ];
  for (const p of paths) {
    try {
      execSync(`test -f ${p}`);
      return p;
    } catch(_) {}
  }
  // Fallback: cerca con which
  try {
    return execSync('which chromium || which chromium-browser || which google-chrome', {encoding:'utf8'}).trim();
  } catch(_) {}
  return null;
}

async function launch() {
  const execPath = findChromium();
  if (!execPath) throw new Error('Chromium non trovato nel sistema');
  log(`Chromium trovato: ${execPath}`);

  const browser = await puppeteer.launch({
    executablePath: execPath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ]
  });

  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') log(`[browser:error] ${msg.text()}`);
  });
  page.on('pageerror', err => log(`[browser:pageerror] ${err.message}`));

  log(`Apertura ${APP_URL}`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 60000 });
  log('Pagina caricata. Motore attivo.');
  return { browser, page };
}

async function checkAlive(page) {
  return await page.evaluate(() => {
    try {
      const s = window.state;
      if (!s) return { ok: false, reason: 'state undefined' };
      return {
        ok: true,
        lastCycle: s.lastCycleAt || (s.meta && s.meta.lastCycleAt) || null,
        openTrades: (s.paper && s.paper.open ? s.paper.open.length : 0),
        closedTrades: (s.paper && s.paper.closed ? s.paper.closed.length : 0),
        regime: s.lastAnalysis && s.lastAnalysis.regimeResult ? s.lastAnalysis.regimeResult.regime : null
      };
    } catch(e) {
      return { ok: false, reason: e.message };
    }
  });
}

async function run() {
  let browser, page;
  let lastReload = Date.now();

  try {
    ({ browser, page } = await launch());
  } catch (err) {
    log(`Errore avvio: ${err.message}`);
    process.exit(1);
  }

  setInterval(async () => {
    try {
      const alive = await checkAlive(page);
      if (alive.ok) {
        log(`Health OK — regime:${alive.regime} open:${alive.openTrades} closed:${alive.closedTrades}`);
      } else {
        log(`Health WARN — ${alive.reason}`);
      }
      if (Date.now() - lastReload > RELOAD_EVERY) {
        log('Reload periodico...');
        await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
        lastReload = Date.now();
        log('Reload completato.');
      }
    } catch (err) {
      log(`Check fallito: ${err.message} — riavvio...`);
      try { await browser.close(); } catch(_) {}
      try {
        ({ browser, page } = await launch());
        lastReload = Date.now();
      } catch (e) {
        log(`Riavvio fallito: ${e.message}`);
        process.exit(1);
      }
    }
  }, CHECK_EVERY);

  log(`Keeper attivo. Check ogni ${CHECK_EVERY/60000}min, reload ogni ${RELOAD_EVERY/60000}min.`);
}

run();
