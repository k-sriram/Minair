
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

This repository is a static site and can be hosted using GitHub Pages.

Steps to publish:

1. Create a new repository on GitHub (for a user site it must be named `your-username.github.io`).
2. Add the remote and push the `main` branch.

PowerShell example (replace values):

```powershell
git remote add origin https://github.com/<your-username>/<repo-name>.git
git branch -M main
git push -u origin main
```

3. In your GitHub repository, go to Settings → Pages.
4. Under "Source", select "Deploy from a branch".
5. Choose "main" branch and "/ (root)" folder.
6. Click "Save".

Your site will be live at `https://username.github.io/` (for user sites) or `https://username.github.io/repo-name/` (for project sites) within a few minutes.

Notes:
- The site will automatically update when you push new commits to the `main` branch.
- You can add a `CNAME` file to the repo root if you want a custom domain.
