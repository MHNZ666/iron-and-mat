# Iron and Mat

A 5-day, 45-minute gym plan for BJJ: 5/3/1 strength, knees-over-toes joint work and conditioning, with logging, timers, pain flags, a built-in review and WHOOP session summaries.

The app is a single page (`index.html`) served by GitHub Pages:
https://mhnz666.github.io/iron-and-mat/

Training data stays on the phone (browser storage). Use **Settings → Copy backup** now and then.

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
