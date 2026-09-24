# DLF Forum 2017 static archive

First-pass Eleventy migration of the WordPress export. Original public page paths are preserved. This is a review preview, not yet a visually faithful or self-contained archive.

## Local preview

```sh
npm ci
npm start
```

Open the URL printed by Eleventy. The generated content is committed separately from the private WordPress source material, so routine builds do not need Python or WordPress.

## Reimport after changing the XML or importer

Requires Python 3.9+ and the original export under `data/`.

```sh
npm run import:wordpress
npm run build
python3 scripts/check-archive.py
```

`src/_data/wordpress.json` and `src/assets/wordpress-custom.css` are generated; edit the importer or original source instead. The import includes only published content of selected public types, excluding drafts, statistics records, and private metadata. Source HTML is trusted archival content, not an untrusted upload interface.

## Assets

Uploads in `src/uploads` publish at `/wp-content/uploads/sites/15/`. Theme frontend assets have been copied into `src/assets/fudge-2` and `src/assets/fudge2-child`; PHP is excluded. These public assets and the uploads must be committed for a deployment checkout to reproduce the preview. No source PHP or theme archives should be published. No deployment workflow is enabled yet.

## Review before deployment

- `data/migration-report.json`: missing referenced records, simplified sections, omitted dynamic sections, empty source pages, and external-service dependencies.
- `data/link-report.json`: local HTML links and image references (including srcset), residual supported shortcode syntax, and accidental PHP output. External links, CSS URLs, and fragment targets are not checked.
- Header/footer are provisional. Theme option values, dynamic CSS, logo selection, and social account settings still need recovery from WordPress or comparison with a rendered capture.
- Sections use the exported text and entity selections, with simplified layouts. Maps link to exported venue records; countdowns, newsletter forms, and Twitter widgets are omitted and reported. Cart/account/checkout pages explain that transactions are unavailable.
- Sched remains an external JavaScript embed. A separate program export is required for offline preservation. WordPress session/ticket records may be theme demo data; they are retained for review, not assumed to be the actual conference program.
- Compare desktop/mobile screenshots, embedded media, custom CSS, and older demo pages before publishing.
- URLs assume hosting at the domain root, ideally `forum2017.diglib.org`; a GitHub repository subpath needs a separate URL-prefix pass.

The importer corrects the malformed local Twitter/IMLS links and the outdated `/visitors-guide/` link found in the export. It leaves uploaded files untouched.
