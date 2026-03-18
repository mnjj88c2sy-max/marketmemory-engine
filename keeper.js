// MarketMemory — Railway Keeper v7
// Apre la pagina, inietta API key, avvia il motore automaticamente.
//
// Variabili Railway richieste:
//   MM_URL    = https://backtest-bomber.netlify.app
//   MM_APIKEY = la-tua-api-key-twelvedata

const puppeteer = require('puppeteer-core');

const APP_URL      = process.env.MM_URL            || 'https://backtest-bomber.netlify.app';
const API_KEY      = process.env.MM_APIKEY         || '';
const RELOAD_EVERY = parseInt(process.env.RELOAD_EVERY_MIN || '120') * 60 * 1000;
const CHECK_EVERY  = parseInt(process.env.CHECK_EVERY_MIN  || '5')   * 60 * 1000;
const TZ           = process.env.TZ || 'Europe/Rome';
const CHROMIUM     = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';

function ts()  { return new Date().toLocaleString('it-IT', { timeZone: TZ }); }
function log(m){ console.log(`[${ts()}] ${m}`); }

async function launch() {
  log(`Avvio Chromium: ${CHROMIUM}`);
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM,
    headless: 'new',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu','--single-process']
  });

  const page = await browser.newPage();
  page.on('console', msg => { if(msg.type()==='error') log(`[browser:error] ${msg.text()}`); });
  page.on('pageerror', err => log(`[browser:pageerror] ${err.message}`));

  // 1. Carica la pagina
  log(`Apertura ${APP_URL}`);
  await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  // 2. Inietta API key nel localStorage (chiave usata da app.js: TWELVE_API_KEY)
  if (API_KEY) {
    await page.evaluate((key) => {
      localStorage.setItem('TWELVE_API_KEY', key);
      // Aggiorna anche l'input UI se presente
      var inp = document.getElementById('apiKey');
      if (inp) { inp.value = key; inp.dispatchEvent(new Event('input')); }
    }, API_KEY);
    log('API key iniettata nel localStorage.');
  } else {
    log('WARN: MM_APIKEY non impostata — il motore non potrà chiamare TwelveData.');
  }

  // 3. Reload per assicurarsi che loadState() legga la chiave
  log('Reload post-inject...');
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });

  // 4. Avvia il motore — cerca bottone "Avvia motore"
  await new Promise(r => setTimeout(r, 2000)); // attendi UI
  const started = await page.evaluate(() => {
    var btn = Array.from(document.querySelectorAll('button'))
      .find(b => b.innerText.includes('Avvia') || b.innerText.includes('Start'));
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (started) {
    log('Motore avviato (click "Avvia motore").');
  } else {
    log('WARN: bottone "Avvia motore" non trovato — motore non avviato.');
  }

  // 5. Attendi che window.state si popoli
  await new Promise(r => setTimeout(r, 8000));

  log('Pagina caricata. Keeper attivo.');
  return { browser, page };
}

async function checkAlive(page) {
  return await page.evaluate(() => {
    try {
      var s = window.state;
      if (!s) return { ok: false, reason: 'state undefined' };
      return {
        ok: true,
        openTrades:   (s.paper && s.paper.open   ? s.paper.open.length   : 0),
        closedTrades: (s.paper && s.paper.closed ? s.paper.closed.length : 0),
        regime: s.lastAnalysis && s.lastAnalysis.regimeResult
                ? s.lastAnalysis.regimeResult.regime : 'unknown',
        apiKey: s.apiKey ? '✓' : '✗'
      };
    } catch(e) { return { ok: false, reason: e.message }; }
  });
}

async function run() {
  var browser, page, lastReload = Date.now();

  try { ({ browser, page } = await launch()); }
  catch(err) { log(`Errore avvio: ${err.message}`); process.exit(1); }

  setInterval(async () => {
    try {
      var alive = await checkAlive(page);
      if (alive.ok) {
        log(`Health OK — regime:${alive.regime} open:${alive.openTrades} closed:${alive.closedTrades} apiKey:${alive.apiKey}`);
      } else {
        log(`Health WARN — ${alive.reason}`);
        // Se state è ancora undefined dopo 10min, prova a riavviare il motore
        var btn = await page.evaluate(() => {
          var b = Array.from(document.querySelectorAll('button'))
            .find(b => b.innerText.includes('Avvia') || b.innerText.includes('Start'));
          if (b) { b.click(); return true; }
          return false;
        });
        if (btn) log('Re-click "Avvia motore" tentato.');
      }

      if (Date.now() - lastReload > RELOAD_EVERY) {
        log('Reload periodico...');
        await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));
        // Re-avvia dopo reload
        await page.evaluate(() => {
          var b = Array.from(document.querySelectorAll('button'))
            .find(b => b.innerText.includes('Avvia') || b.innerText.includes('Start'));
          if (b) b.click();
        });
        lastReload = Date.now();
        log('Reload e re-avvio completati.');
      }
    } catch(err) {
      log(`Check fallito: ${err.message} — riavvio browser...`);
      try { await browser.close(); } catch(_) {}
      try { ({ browser, page } = await launch()); lastReload = Date.now(); }
      catch(e) { log(`Riavvio fallito: ${e.message}`); process.exit(1); }
    }
  }, CHECK_EVERY);

  log(`Keeper attivo. Check ogni ${CHECK_EVERY/60000}min, reload ogni ${RELOAD_EVERY/60000}min.`);
}

run();
