# retroachievements-gallery-personal

A static RetroAchievements artpiece showing recent achievements, mastered/completed games, and rich presence.

Quick start
- Copy `config.template.js` to `config.js` and fill in your username + API key.
- Open `index.html` from a local server (some browsers block fetch on file://). Example: `python -m http.server`.

GitHub Pages secrets option
- Add repo secrets: `RA_USERNAME` and `RA_API_KEY`.
- Enable GitHub Pages and use the included workflow to build `config.js` during deploy.
- The key is still embedded into the built site output (client-side). Treat it as public.

Local overrides
- Use `?user=YOUR_NAME&key=YOUR_KEY` in the URL to override the config for one session.

