"""Audit built routes, local assets, fragments, and basic archive accessibility."""
import argparse
import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
CSS_URL = re.compile(r'url\(\s*[\'"]?([^\'"\)\s]+)[\'"]?\s*\)', re.I)

class Document(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.urls = []
        self.ids = set()
        self.main = 0
        self.notice = False
        self.skip = False
        self.issues = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if d.get('id'):
            self.ids.add(d['id'])
        if tag == 'a' and d.get('name'):
            self.ids.add(d['name'])
        if tag == 'main': self.main += 1
        if 'archive-notice' in d.get('class', '').split(): self.notice = True
        if 'skip-link' in d.get('class', '').split() and d.get('href') == '#main': self.skip = True
        if tag == 'img' and 'alt' not in d: self.issues.append('Image missing alt')
        if tag == 'a' and d.get('href') == '#': self.issues.append('Inactive hash link')
        if tag == 'form': self.issues.append('Unadapted form')
        for key, value in attrs:
            if not value: continue
            if key in ('href', 'src', 'poster'): self.urls.append(value)
            if key == 'srcset':
                self.urls.extend(part.strip().split()[0] for part in value.split(',') if part.strip())
            if key == 'style': self.urls.extend(CSS_URL.findall(value))


def audit(site, expected):
    site = site.resolve()
    pages = {p.resolve(): Document(p.read_text()) for p in site.rglob('*.html')}
    missing = {}
    fragments = {}
    issues = {}
    shortcodes = []
    checked_css = set()

    def reference(url, source):
        parsed = urlsplit(url)
        if parsed.scheme or parsed.netloc: return
        path = unquote(parsed.path)
        target = (site / path.lstrip('/')) if path.startswith('/') else (source.parent / path if path else source)
        target = target.resolve()
        if not target.is_relative_to(site):
            missing.setdefault(url, set()).add(str(source.relative_to(site)))
            return
        if target.is_dir(): target = target / 'index.html'
        if not target.is_file():
            missing.setdefault(url, set()).add(str(source.relative_to(site)))
        elif parsed.fragment and target in pages and unquote(parsed.fragment) not in pages[target].ids:
            fragments.setdefault(url, set()).add(str(source.relative_to(site)))
        elif target.suffix == '.css' and target not in checked_css:
            checked_css.add(target)
            css = re.sub(r'/\*.*?\*/', '', target.read_text(), flags=re.S)
            for asset in CSS_URL.findall(css): reference(asset, target)
            for asset in re.findall(r'@import\s+[\'"]([^\'"]+)', css): reference(asset, target)

    for page, doc in pages.items():
        for url in doc.urls: reference(url, page)
        if doc.main != 1: doc.issues.append('Expected exactly one main element')
        if not doc.notice: doc.issues.append('Missing archive notice')
        if not doc.skip: doc.issues.append('Missing skip link')
        if doc.issues: issues[str(page.relative_to(site))] = sorted(set(doc.issues))
        if re.search(r'\[/?(?:efcb-section-|woocommerce_|sched\s)', page.read_text()):
            shortcodes.append(str(page.relative_to(site)))
    actual = {'/' + str(p.relative_to(site)).removesuffix('index.html') for p in pages}
    return {
        'pageCount': len(pages),
        'emptyBuild': not bool(pages),
        'missingRoutes': sorted(set(expected) - actual),
        'unexpectedRoutes': sorted(actual - set(expected)),
        'missingLocalReferences': {k: sorted(v) for k, v in sorted(missing.items())},
        'missingFragments': {k: sorted(v) for k, v in sorted(fragments.items())},
        'accessibilityAndArchiveIssues': issues,
        'unrenderedShortcodePages': shortcodes,
        'publishedPHP': [str(p.relative_to(site)) for p in site.rglob('*.php')],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, default=ROOT / '_site')
    parser.add_argument('--manifest', type=Path, default=ROOT / 'data/public-routes.json')
    parser.add_argument('--report', type=Path, default=ROOT / 'data/link-report.json')
    args = parser.parse_args()
    report = audit(args.site, json.loads(args.manifest.read_text()))
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    failed = any(value for key, value in report.items() if key != 'pageCount')
    print(f"{report['pageCount']} pages checked; {'FAIL' if failed else 'PASS'} (details: {args.report})")
    return int(failed)

if __name__ == '__main__':
    raise SystemExit(main())
