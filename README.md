# Iron and Mat

A 5-day, 45-minute gym plan for BJJ: 5/3/1 strength, knees-over-toes joint work and conditioning, with logging, timers, pain flags, a built-in review and WHOOP session summaries.

The app is a single page (`index.html`) served by GitHub Pages:
https://mhnz666.github.io/iron-and-mat/

Training data stays on the phone (browser storage). It can also back up to a **private** repo (see below). Never back up to this repo: it is public.

## GitHub backup

1. Create a private repo named `iron-and-mat-data` (leave it empty or add a README).
2. Create a fine-grained token at github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens. Repository access: **Only select repositories** → `iron-and-mat-data`. Permissions: **Contents: Read and write**. Set an expiry (for example one year).
3. In the app: Settings → GitHub backup. Paste the token, check the repo name, Save, then tap Back up now.

Each backup also writes `summary.md`, a plain-language training summary. A scheduled Claude session reads it every Sunday evening and writes `review.json` to the same private repo; the app shows that review in the Review tab, with suggested training-max changes as buttons you choose to apply.

The app backs up after each finished session and each new week or cycle, and you can restore on any phone. The token is kept on the phone only and is never written into the backup.

## Claude review outside Claude (optional)

The "Review my training" button needs a small server that holds your Anthropic API key. The code is in `worker/worker.js`.

1. **API key.** Go to console.anthropic.com, add a small amount of credit, create an API key, and set a monthly spend limit (Settings → Limits). A review costs a few cents.
2. **Cloudflare Worker.** Make a free Cloudflare account. Open Workers & Pages → Create → Create Worker, give it a name, Deploy, then Edit code. Replace the code with `worker/worker.js` and Deploy again.
3. **Settings.** In the worker, open Settings → Variables and Secrets and add:
   - `ANTHROPIC_API_KEY` as a Secret: your API key
   - `ACCESS_CODE` as a Secret: a long passphrase you make up
   - `ALLOWED_ORIGIN` as Text: `https://mhnz666.github.io`
4. **In the app.** Settings → Claude review server: paste the worker address (`https://<name>.<you>.workers.dev`) and the same access code, then Save.

Never put the API key in this repo or in the app. The repo is public.
