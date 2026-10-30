# Forge & Familiar

A D&D 5e character manager: guided character builder, live character sheet, and dice, for you and your friends. Rules data is SRD 5.1 only.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # Vitest
npm run build
```

Characters and player profiles are saved in the browser for now (see `src/storage/`).

## Online version

The app is live at https://forge-and-familiar.onrender.com, a free Render static site (build `npm ci && npm run build`, publish `dist`, Node 22). Every push to `main` rebuilds and republishes it, through Render's auto-deploy and the `Deploy to Render` GitHub Action (repo secret `RENDER_DEPLOY_HOOK`). After each push, the `Live site check` GitHub Action waits until `https://forge-and-familiar.onrender.com/version.json` names the pushed commit, then opens the site in a phone-sized browser and fails on page errors (`scripts/live/check.mjs`). Its result is how to confirm a change is live.
