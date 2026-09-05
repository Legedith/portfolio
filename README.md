# Legedith — Intelligence, embodied.

Jatin Dehmiwal's portfolio: a restrained research-notebook layout and an actual seven-joint inverse-kinematics study. Built with static HTML, CSS and JavaScript. No runtime dependencies, remote assets, model downloads, analytics, or build step.

## The study

**Reach a target:** drag the crosshair; joint angles are solved numerically.

**Hold the point:** explore null-space motion. The arm changes posture while its tool point stays nearly fixed; orientation remains free. The residual is measured and displayed.

**Trace a knot:** follow a three-dimensional trefoil using freshly solved IK, not prerecorded joint angles.

Joint-axis and velocity-dexterity overlays, a rotatable view, and a method note expose the mechanics without turning the homepage into a dashboard. Touch, keyboard, reduced-motion, and no-JavaScript paths are supported. Read **[METHODS.md](METHODS.md)** for the exact algorithms, assumptions, limitations and references.

## Files

- `index.html`: restrained homepage, study controls, selected work and method dialog.
- `assets/kinematics.js`: forward kinematics, Jacobian, damped IK, true null projection, eigensystem and trajectory.
- `assets/renderer.js`: dependency-free shaded 3D geometry on Canvas 2D.
- `assets/research.js`: input, scheduling, modes, numerical telemetry, accessibility and bounded histories.
- `assets/research.css`: responsive layout, typography and print styles.
- `tests/kinematics.test.mjs`: deterministic mathematical regression tests.
- `scripts/test_research_browser.py`: optional offline Chromium regression suite.

## Run

```sh
python3 -m http.server 8000
# Open http://localhost:8000. ES modules need an HTTP server, not file://.
node --test tests/kinematics.test.mjs
python3 scripts/check_site.py
# Browser tests require the development-only Playwright package and Chromium:
python3 scripts/test_research_browser.py --chromium /usr/bin/chromium
```

GitHub Actions runs static resource checks, module syntax checks and numerical tests. The browser suite was separately run at 12 viewport sizes: 38 checks passed with no JavaScript runtime errors. These are offline Chromium checks, not physical-device, Safari, full accessibility, or live-network performance results. `tests/numerical-results.txt` and `tests/research-browser-results.json` record the runs.

## Root URL

This repository is still named `portfolio`. GitHub user sites require the name `legedith.github.io` to publish at `https://legedith.github.io/`. Rename this repository in **Settings → General**, then confirm **Settings → Pages → Deploy from a branch → main → / (root)**. The connected content tool does not expose repository renaming or Pages administration.

The same relative assets work at `/portfolio/` before that move and at `/` afterwards. Existing `portfolio/index.html` preserves the old address after renaming. Canonical metadata points at the intended root address. Official instructions: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

## Preserve and roll back

The robot-playground edition is preserved at commit `4a5024cf703b7fd9f3bcdd29231c937448f771ba` and the branch `archive/before-kinematic-study-2026-09-05`. Previous archive branches and `archive-2021.html` remain intact. Legacy assets are not loaded by this homepage. Revert the research-study commit to restore the preceding site without rewriting history.
