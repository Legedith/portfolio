# Legedith — Human ideas. Robot hands.

Jatin Dehmiwal's interactive robotics portfolio. A small robot, a blank page, and three real projects. Static HTML, CSS, and JavaScript. No build step, remote font, analytics, API key, or runtime dependency.

## Play

Draw on the paper with a mouse, pen, or finger. The robot's two-joint arm follows using analytical inverse kinematics. Replay your sketch, request one of four procedural doodles, greet the robot, or switch on X-ray mode. Sound is off unless explicitly enabled. No microphone, camera, or device-motion permission is requested.

On the focused pad: arrow keys move the pen; Space lowers or lifts it; Enter replays; Escape stops. Tab leaves the pad. Project and biography dialogs support Escape, focus wrapping, and focus restoration. All project/contact links remain usable without JavaScript.

Only the paper captures touch, so the rest of the page scrolls normally. Drawings stay in memory, are capped at 16 strokes / 1,800 points, and are not uploaded or saved. Animation stops when the lab leaves the viewport or the tab is hidden. System reduced motion and the manual motion toggle disable animated replay but keep drawing and presets usable.

**This is a browser simulation, not a live robot or an AI model.** BrushOS is a separate physical prototype, linked from the first project card.

## Publish at `https://legedith.github.io/`

GitHub's user-site repository must be named **`legedith.github.io`**. The site currently lives in the `portfolio` repository. Code writes do not change the repository name, and the connected tool does not expose repository renaming or Pages administration.

In this repository's **Settings → General**, rename `portfolio` to `legedith.github.io`. In **Settings → Pages**, confirm **Deploy from a branch → main → / (root)**. Wait for the Pages build to finish. No website-code changes are needed for this move.

The same files work before the rename at `/portfolio/` and after it at `/`. Relative assets are used throughout. `portfolio/index.html` preserves the old `/portfolio/` address after the move; its redirect carries the query string and fragment when JavaScript is available. Canonical metadata and the sitemap point at the intended root URL.

See [GitHub's user-site instructions](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site).

## Edit and test

- `index.html`: homepage, functional SVG robot, project cards, and dialogs.
- `assets/lab.css`: responsive layout and visual/reduced-motion states.
- `assets/lab.js`: bounded drawing history, inverse kinematics, playback, input handling, and dialogs.
- `assets/lab-mark.svg`: favicon.
- `SOURCES.md`: public content provenance.

```sh
python3 -m http.server 8000
python3 scripts/check_site.py
node --check assets/lab.js
# Optional development-only dependency; not used by the website:
python3 -m pip install playwright
python3 scripts/test_browser.py --chromium /usr/bin/chromium
```

GitHub Actions runs the static checker and JavaScript syntax check on pushes and pull requests. The offline Chromium suite was run locally at 12 viewport sizes, including 320px phones and landscape. It passed 35 interaction checks with no JavaScript runtime errors. The suite covers mouse and emulated touch drawing, scrolling outside the paper, replay consistency, joint geometry, rapid input, keyboard drawing, dialog focus, reduced motion, and no-JavaScript fallback. The committed report is `tests/browser-results.json`. This is not a physical-device test, Safari test, complete accessibility audit, or live-network performance result.

## History and rollback

The previous editorial version is preserved on `archive/before-robot-playground-2026-09-05`, at commit `f0894f7b9da6026374211753c117e1fdd74f15de`. The 2021 original remains on `archive/pre-refresh-2026-09-05` and at `archive-2021.html`. Existing legacy assets are untouched. The archived site's original motion/audio behavior is separate from this edition. Revert the robot-playground commit to restore the preceding homepage without rewriting history.
