# DLF Forum 2017 static archive

Eleventy publishes 124 original public URLs. 121 use captured, rendered WordPress HTML and the original Fudge 2 theme assets, including the live site's generated color/font CSS. Cart, checkout, and account routes retain static archival messages.

## Build and preview

```sh
npm ci
npm start
```

Alternatively, run `npm run build` and serve `_site` with any static server. Builds use local generated data and assets; they do not contact WordPress or require Python.

## Import workflow

Requires Python 3.9+ and the source files under ignored `data/` directories:

```sh
npm run import:wordpress
npm run import:rendered
npm run build
npm run check
```

Run both import commands in order: the WXR importer creates the base data, then the rendered importer overlays faithful page documents from `data/rendered/<wordpress-id>.html`. Running only the WXR importer restores the earlier approximate layouts. Keep those private source captures for reproducibility.

Generated output is stored in `src/_data/wordpress.json`. Do not edit it directly. Edit `scripts/import-rendered.py` for capture transformations or `scripts/import-wordpress.py` for WXR data. The captured documents retain their original theme classes, inline section styling, header, footer, body classes, and content. `src/assets/fudge-dynamic.css` is the captured public `admin-ajax.php?action=dynamic-css` response; it is now an ordinary static stylesheet.

## Static adaptations

- Removed both accessibility plugins' assets, toolbar markup, and styles. Ordinary HTML accessibility remains.
- Removed analytics, WordPress/plugin runtime scripts, forms, and unused API-discovery links. Small local JavaScript handles the navigation and scrolled header.
- Preserved Sched's HTTPS embed and added a direct schedule link. The preview rendered the theme correctly, but the remote schedule iframe did not finish loading during verification. Sched and Google Fonts remain external dependencies.
- Decoded public Cloudflare email-protection links locally.
- Preserved local upload paths and corrected malformed internal Twitter/IMLS and visitor-guide links.
- Interactive maps, dynamic pagination, forms, and other server-backed behaviors are not recreated. Their surrounding original markup may remain; these need a separate functionality pass before publication.

## Assets and deployment

`src/uploads` publishes at `/wp-content/uploads/sites/15/`. Original frontend theme assets live in `src/assets/fudge-2` and `src/assets/fudge2-child`; PHP source and accessibility plugins are not published. Commit the generated data and required public assets/uploads for repeatable GitHub builds. No deployment is enabled yet.

URLs target the domain root, preferably `forum2017.diglib.org`. A GitHub project subpath would need URL-prefix handling.

## Validation

`npm run check` audits generated HTML links, images/srcset, remaining supported shortcode syntax, and PHP output. It does not fetch external links or check CSS URLs or fragments. Reports:

- `data/rendered-report.json`: captured page count and fallback routes.
- `data/link-report.json`: generated HTML audit.
- `data/migration-report.json`: original WXR import findings; many simplified-section entries are superseded by the rendered captures.

The desktop homepage hero, colors, logo/navigation, feature panels, and speaker cards were visually checked in Chrome. Broader responsive and interactive-feature review remains before publication.
