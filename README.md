# retroachievements-gallery-personal

A static RetroAchievements artpiece showing recent achievements, mastered/completed games, and rich presence.

Quick start
- Copy `config.template.js` to `config.js` and fill in your username + API key.
- Open `index.html` from a local server (some browsers block fetch on file://). Example: `python -m http.server`.

Cache assets (optional)
- Run `powershell -ExecutionPolicy Bypass -File scripts/update-cache.ps1` to download console icons and achievement badges.
- This also writes `assets/cache/consoles.json`, `assets/cache/achievement-badges.json`, and `assets/cache/achievements.json` for local name/icon lookups.
- Completion progress can be cached in `assets/cache/completion.json` (used by the Completion Vault).
- Beaten games can be cached in `assets/cache/awards.json` (used by the Beaten list).

GitHub Pages secrets option
- Add repo secrets: `RA_USERNAME` and `RA_API_KEY`.
- Enable GitHub Pages and use the included workflow to build `config.js` during deploy.

Local overrides
- Use `?user=YOUR_NAME&key=YOUR_KEY` in the URL to override the config for one session.
