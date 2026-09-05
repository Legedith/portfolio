# Legedith — second edition

Jatin Dehmiwal's portfolio. Vintage title cards, curious machines, and actual work.

A static HTML/CSS/JavaScript site. No package manager, build step, runtime API, external font, or analytics script is required for the new edition.

## Publish at the root

The existing repository already has GitHub Pages enabled. To move this portfolio from `https://legedith.github.io/portfolio/` to `https://legedith.github.io/`:

1. In this repository's **Settings → General**, rename `portfolio` to **`legedith.github.io`**.
2. In **Settings → Pages**, confirm **Deploy from a branch → main → / (root)**, then save if needed.
3. Wait for the Pages deployment to finish and open the root URL. Verify the old `/portfolio/` URL redirects there too.

The repository name is required for a GitHub Pages user site. File changes alone cannot change the root address. The connector used for this refresh exposes content writes, not repository renaming or Pages settings.

All new asset paths are relative, so the site also works at the existing project URL before the rename. `portfolio/index.html` preserves old bookmarks after the move, including their query string and fragment when JavaScript is enabled. Search metadata already points at the intended root URL.

Official instructions: [Pages quickstart](https://docs.github.com/pages/quickstart), [renaming a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).

## Edit

- `index.html`: biography, project cards, writing, contact links, and inline illustrations.
- `assets/portfolio.css`: colours, layout, responsive rules, and print/reduced-motion styles.
- `assets/portfolio.js`: optional filters, question switcher, effects preference, and copy-email control.
- `SOURCES.md`: public sources and the limits of the claims used in the portfolio.
- `archive-2021.html`: the earlier title-card site, with its original assets and without its old analytics snippet.

All six projects and every navigation/contact link remain available without JavaScript. Film effects can be switched off; reduced-motion preferences are respected. There is no fake chat, fabricated live telemetry, contact-form backend, or auto-updating biography.

## Preview and test

```sh
python3 -m http.server 8000
# Open http://localhost:8000
python3 scripts/check_site.py
node --check assets/portfolio.js
```

The static checker uses Python's standard library. It runs in GitHub Actions on pushes and pull requests. It validates local page/asset links, fragment targets, page metadata, structured data, and the selected-project count. It does not make external requests or claim those websites are always available.

The refresh was also checked in an offline Chromium renderer at widths 320, 390, 580, 768, 1024, and 1440 pixels, including filters, keyboard activation, reduced motion, copy fallback, and no-JavaScript rendering. These checks are not a full accessibility audit or a verification of a live Pages deployment.

## Preserve and recover

The original main commit is `f11bdc5fe6560e928faff5e5bbbd8ecb0a2f7a79`, preserved on `archive/pre-refresh-2026-09-05`. Existing legacy assets are retained. The original Firebase workflows are retired in favour of branch-based GitHub Pages and static checks; their originals remain on the backup branch. Revert the refresh commit to roll back without rewriting history.

The 2021 archive intentionally keeps its original layout, motion, and audio behaviour. The new edition's accessibility and performance changes do not retroactively apply to that archive.
