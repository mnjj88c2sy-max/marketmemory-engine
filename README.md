# MarketMemory Railway Keeper

Mantiene la pagina MarketMemory (Netlify) aperta H24 su Railway
tramite Puppeteer headless. Non modifica app.js.

## Setup

1. Crea un nuovo progetto su Railway
2. Collega questo repo
3. Aggiungi la variabile d'ambiente:
   MM_URL=https://tua-app.netlify.app
4. Deploy

## Variabili d'ambiente

| Variabile        | Default | Descrizione                        |
|------------------|---------|------------------------------------|
| MM_URL           | —       | URL Netlify (obbligatorio)         |
| TZ               | Europe/Rome | Timezone per i log            |
| RELOAD_EVERY_MIN | 120     | Reload pagina ogni N minuti        |
| CHECK_EVERY_MIN  | 5       | Health check ogni N minuti         |

## Log

Railway mostra i log in real-time. Cercare:
- `Health check OK` → sistema attivo
- `[browser:error]` → errori del motore
- `Reload periodico` → reload programmato
