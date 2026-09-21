# JOSHUA // WOPR

A browser-based fictional WOPR/JOSHUA terminal simulator inspired by the feel of early-1980s strategic-computer cinema.

## Version 0.1

- Full-screen CRT terminal interface.
- Boot sequence and command interpreter.
- `LIST GAMES`, `GREETINGS PROFESSOR FALKEN`, `HELP`, and `CLEAR`.
- Global Thermonuclear War cinematic simulation with repeated fictional scenarios and a no-win conclusion.
- Optional JOSHUA natural-language personality through the OpenAI Responses API.
- Local heuristic fallback, so the terminal still works without an API key.
- Cloudflare Worker + Static Assets deployment.
- No GitHub Actions required.
- No real-world targeting or weapons data.

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.dev.vars.example` to `.dev.vars` and add your OpenAI API key if you want live AI conversation. The app still runs without it.

3. Start the Worker locally:

   ```bash
   npm run dev
   ```

## Deploy directly to Cloudflare

Log in once:

```bash
npx wrangler login
```

Store the API key as a Cloudflare secret:

```bash
npx wrangler secret put OPENAI_API_KEY
```

Deploy:

```bash
npm run deploy
```

This deployment path runs from your machine and does not use GitHub Actions.

## Current game shell

The terminal exposes the planned game catalog. Version 0.1 fully implements the JOSHUA terminal experience and the cinematic Global Thermonuclear War simulation. The traditional board/card game engines are the next module.
