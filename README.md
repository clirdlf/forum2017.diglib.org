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

- Removed both accessibility plugins' assets, toolbar markup, and styles. Captured pages receive a main landmark, skip link, labeled navigation/social links, and alternatives for decorative images.
- Removed analytics, WordPress/plugin runtime scripts, forms, and unused API-discovery links. Small local JavaScript handles the responsive navigation; the header stays in normal document flow below the archive notice.
- Replaced Sched embeds at build time with a local schedule on `/schedule/` and day links on other pages. Session content no longer requires Sched or JavaScript. Google Fonts remain an external dependency.
- Decoded public Cloudflare email-protection links locally.
- Preserved local upload paths and corrected malformed internal Twitter/IMLS and visitor-guide links.
- A shared archive notice identifies historical deadlines and closed event services on every route.
- Empty map widgets become static venue information and a map link. Dead hash-only pagination links and empty newsletter sections are removed at import time. Original historical content is retained.
- Mobile navigation works without JavaScript; when JavaScript is available, it supports expanded state, Escape to close and restore focus, and excludes collapsed links from keyboard navigation.
- `scripts/archive_html.py` owns these adaptations; the notice is shared with fallback pages through `src/_includes/archive-notice.html`.

## Preserved schedule

The public Sched calendar and schedule listing are committed in `data/schedule/`. The calendar supplies 151 session titles, descriptions, locations, categories, and start/end times; the listing supplies speaker names for 103 sessions. Sessions without speaker listings remain unlabeled rather than inferred. Linked presentations, speaker profiles, and other external resources are not mirrored.

`provenance.json` records source URLs, capture time, expected session count, and SHA-256 checksums. Regenerate `src/_data/schedule.json` offline with `npm run import:schedule` (Python 3.9+ with system timezone data). The importer verifies checksums, date ranges, unique IDs, and agreement between the two source captures before writing output. Refreshing captures is a deliberate maintenance task: retrieve the two recorded public URLs, review the changes, and update the provenance manifest before importing.

`lib/schedule.js` builds the local schedule using escaped text and native disclosure controls. Times are converted from the export's UTC timestamps to `America/New_York` (EDT for the conference dates). The unmodified source calendar is available at `/assets/schedule.ics`. Builds use committed JSON and never fetch Sched. Original WordPress captures may still contain embed markup; the renderer removes it from published HTML.

## Assets and deployment

`src/uploads` publishes at `/wp-content/uploads/sites/15/`. Original frontend theme assets live in `src/assets/fudge-2` and `src/assets/fudge2-child`; PHP source and accessibility plugins are not published. Commit the generated data and required public assets/uploads for repeatable GitHub builds. No deployment is enabled yet.

URLs target the domain root, preferably `forum2017.diglib.org`. A GitHub project subpath would need URL-prefix handling.

## Validation

Run `npm run validate` for regression fixtures, the build, and the generated-site audit. GitHub Actions runs the same command on pushes and pull requests. `npm run check` alone checks the existing `_site` output. `data/public-routes.json` is the committed preservation baseline; update it deliberately only when the published route set changes.


`npm run check` audits generated HTML links, images/srcset, remaining supported shortcode syntax, and PHP output. It also checks local fragments, referenced CSS assets, the independent route manifest, and basic archive/accessibility markup. Missing assets, an empty/incomplete build, unexpected routes, or any reported issue fail the command. It does not fetch external links or certify WCAG conformance. Reports:

- `data/rendered-report.json`: captured page count and fallback routes.
- `data/link-report.json`: generated HTML audit.
- `data/migration-report.json`: original WXR import findings; many simplified-section entries are superseded by the rendered captures.

The desktop homepage hero, colors, logo/navigation, feature panels, and speaker cards were visually checked in Chrome. The archive notice and mobile menu were also reviewed at a 390px viewport. Broader assistive-technology, contrast, and page-by-page responsive review remains before publication.
