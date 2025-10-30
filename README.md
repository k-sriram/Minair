
# Minair — Astronomical Observation Planning

Minair is a web-based astronomical observation planning tool that helps astronomers and stargazers determine when celestial objects will be visible and observable from their location.

## What it does

**Target Visibility Planning**: Calculate when astronomical objects rise above the horizon and become observable from your specific location and time.

**Optimal Observation Windows**: Determine the best times to observe targets when they're high enough in the sky and it's dark enough (accounting for solar position).

**Real-time Scheduling**: Sample visibility over time periods to show when each target will be at optimal viewing positions, accounting for Earth's rotation and the changing night sky.

**Coordinate Conversion**: Automatically converts celestial coordinates (Right Ascension/Declination) from the target catalog to local altitude/azimuth positions based on your location.

## Who it's for
- Amateur astronomers planning observing sessions
- Astrophotographers scheduling shoots  
- Observatory scheduling and planning
- Educational astronomy activities
- Anyone asking "when can I see this object from here?"

This is a minimal, static prototype (client-only). Open `index.html` in a browser (file://) or serve the folder with a static server.

## Technical Details

**Client-side Astronomy Engine**: All calculations happen in the browser - no server required. Includes:
- Julian date conversions
- Greenwich/Local Sidereal Time calculations  
- Celestial coordinate transformations (RA/Dec → Alt/Az)
- Solar position calculations to avoid daylight observations
- Visibility window detection and scheduling

**Files**:
- `index.html` — UI and entrypoint
- `styles.css` — basic styles
- `src/astronomy.js` — core astronomy calculations (JD, GST/LST, RA/Dec → Alt/Az, solar position)
- `src/scheduler.js` — sampling and window detection for optimal observation times
- `src/ui.js` — minimal UI wiring and plotting
- `data/targets.json` — astronomical target catalog with celestial coordinates

**Notes**:
- This is a prototype: algorithms are simplified and suitable for planning and visualization, not precise astrometry
- Future enhancements: web worker offloading, refined solar position, expanded target catalog, improved visualization (D3/canvas Gantt chart)

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
