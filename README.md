
Minair — Prototype

This is a minimal, static prototype of the Minair web app (client-only). Open `index.html` in a browser (file://) or serve the folder with a static server.

Files:
- `index.html` — UI and entrypoint
- `styles.css` — basic styles
- `src/astronomy.js` — core astronomy calculations (JD, GST/LST, RA/Dec -> Alt/Az, solar position)
- `src/scheduler.js` — sampling and window detection
- `src/ui.js` — minimal UI wiring and plotting
- `data/targets.json` — small target catalog

Notes:
- This is a prototype: algorithms are simplified and suitable for planning and visualization, not precise astrometry.
- Next steps: add web worker offloading, refine solar position, add more targets, and improve visualization (D3/canvas Gantt chart).

To run locally (PowerShell):

# Serve with a simple http server (Python)
python -m http.server 8000

Then open http://localhost:8000 in your browser.

## Deploying to GitHub Pages

This repository is a static site and can be hosted using GitHub Pages. The repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that will publish the repository root to GitHub Pages whenever you push to the `main` branch.

Steps to publish:

1. Create a new repository on GitHub (for a user site it must be named `your-username.github.io`).
2. Add the remote and push the `main` branch.

PowerShell example (replace values):

```powershell
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

3. After push, the GitHub Actions workflow will run and publish the site. For a user/organization site (repo named `username.github.io`) the site will be live at `https://username.github.io/` once deployment completes.

Notes:
- If you want the site on a `gh-pages` branch instead, change the workflow or use a different deployment action. The included workflow publishes the repository root (no build) from `main`.
- You can add a `CNAME` file to the repo root if you want a custom domain.
