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

The app is hosted as a free Render static site (`render.yaml`). Every push to `main` rebuilds and republishes it. Characters are still saved per device and browser until accounts exist.
