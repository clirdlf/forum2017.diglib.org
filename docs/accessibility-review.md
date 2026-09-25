# Accessibility review — 2026-09-25

Reviewed all 125 generated HTML pages for structural issues, plus rendered desktop/mobile examples in Chrome. This is a focused review, not a WCAG conformance certification or a full screen-reader audit.

## Findings addressed

- Replaced the logo's heading with a neutral container and gave each page one content H1. Normalized subsequent heading levels while preserving sibling relationships, text, and existing anchor IDs.
- Added accessible names to image-only internal links when their destination supplies the label; preserved existing image alternatives and the logo's name.
- Reviewed empty image alternatives. Decorative hero images and fellow portraits adjacent to their names remain empty to avoid redundant announcements. Added descriptions to four informative images: the two handwriting-search illustrations and two Limb Gallery article images.
- Added column scope to headers in all four preserved tables. Tables have named, keyboard-focusable scrolling regions for narrow screens.
- Replaced generic recording iframe titles with their preceding section headings and repaired a duplicate iframe ID. Recording content itself remains third-party material.
- Corrected dark text on blue buttons: the observed text/background contrast changed from approximately 3.02:1 to 6.08:1. Applied a solid blue background to hero headings to keep their white text readable over photos. Corrected text contrast in the volunteer-page navigation panels.
- Repaired two empty volunteer-page navigation destinations so each panel reaches its committee table.
- Kept visible keyboard focus, skip navigation, the responsive menu's expanded state and Escape behavior, and reduced-motion styling.

## Verification

- The generated-site audit checks one H1, no skipped heading levels, main landmarks, skip links, named links, image alt presence, iframe titles, table header scope, duplicate IDs, local links/fragments, and page descriptions. All 125 HTML pages pass.
- Inspected the news index at desktop and 390px widths: readable text, wrapping headings, and no horizontal page overflow in the reviewed layout.
- Used Tab and Enter to activate the news page's skip link; focus moved to the main landmark.
- Inspected the 404 page at 390px: its explanation and recovery links remain visible and readable.
- Inspected the volunteer page at 390px: tables fit within their named scrolling regions and the page does not overflow horizontally. Checked generated column scopes and the repaired heading outline.
- Confirmed the local font stylesheet loads in Chrome; local WOFF2 requests returned HTTP 200. Font file signatures and provenance checksums are regression-tested.

## Remaining review limits

- External recordings still need a separate check for captions, transcripts, player keyboard access, and availability; changing the iframe title does not fix the hosted media.
- Not every image's existing author-supplied description was assessed for quality, and every historical layout was not visually tested at every zoom level.
- A screen-reader pass with VoiceOver/NVDA and broader browser/zoom testing remain useful before claiming conformance. The structural checker does not measure all contrast, reading order, or dynamic assistive-technology behavior.
