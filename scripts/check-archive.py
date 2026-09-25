"""Audit built routes, local assets, fragments, and basic archive accessibility."""
import argparse
import json
import re
import xml.etree.ElementTree as ET
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
        self.h1 = 0
        self.previous_heading = 0
        self.description = 0
        self.link = None
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if d.get('id'):
            if d['id'] in self.ids: self.issues.append('Duplicate ID: ' + d['id'])
            self.ids.add(d['id'])
        if tag == 'a' and d.get('name'):
            self.ids.add(d['name'])
        if tag == 'main': self.main += 1
        if tag == 'meta' and d.get('name') == 'description' and d.get('content', '').strip(): self.description += 1
        if re.fullmatch(r'h[1-6]', tag):
            level = int(tag[1])
            if level == 1: self.h1 += 1
            if level > self.previous_heading + 1: self.issues.append('Skipped heading level')
            self.previous_heading = level
        if tag == 'iframe' and not d.get('title', '').strip(): self.issues.append('Iframe missing title')
        if tag == 'th' and not d.get('scope'): self.issues.append('Table header missing scope')
        if tag == 'a' and d.get('href'):
            self.link = [d['href'], d.get('aria-label', '') + d.get('title', '')]
        if tag == 'img' and self.link: self.link[1] += d.get('alt', '')
        if tag == 'link' and re.search(r'fonts\.(googleapis|gstatic)\.com', d.get('href', '')): self.issues.append('Remote Google Fonts dependency')
        if 'archive-notice' in d.get('class', '').split(): self.notice = True
        if 'skip-link' in d.get('class', '').split() and d.get('href') == '#main': self.skip = True
        if tag == 'img' and 'alt' not in d: self.issues.append('Image missing alt')
        if tag == 'a' and d.get('href') == '#': self.issues.append('Inactive hash link')
        if tag == 'form': self.issues.append('Unadapted form')
        if tag in ('script', 'iframe') and 'sched.com' in d.get('src', ''):
            self.issues.append('Remote Sched runtime must be replaced with local content')
        for key, value in attrs:
            if not value: continue
            if key in ('href', 'src', 'poster'): self.urls.append(value)
            if key == 'srcset':
                self.urls.extend(part.strip().split()[0] for part in value.split(',') if part.strip())
            if key == 'style': self.urls.extend(CSS_URL.findall(value))

    def handle_data(self, value):
        if self.link: self.link[1] += value

    def handle_endtag(self, tag):
        if tag == 'a' and self.link:
            if not self.link[1].strip(): self.issues.append('Link missing accessible name: ' + self.link[0])
            self.link = None


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
        if parsed.hostname in ('fonts.googleapis.com', 'fonts.gstatic.com'):
            issues.setdefault(str(source.relative_to(site)), []).append('Remote Google Fonts dependency')
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
        if doc.h1 != 1: doc.issues.append('Expected exactly one h1')
        if doc.description != 1: doc.issues.append('Expected one page description')
        if doc.main != 1: doc.issues.append('Expected exactly one main element')
        if not doc.notice: doc.issues.append('Missing archive notice')
        if not doc.skip: doc.issues.append('Missing skip link')
        if doc.issues: issues[str(page.relative_to(site))] = sorted(set(doc.issues))
        if re.search(r'\[/?(?:efcb-section-|woocommerce_|sched\s)', page.read_text()):
            shortcodes.append(str(page.relative_to(site)))
    if '/schedule/' in expected:
        schedule_page = pages.get(site / 'schedule/index.html')
        sessions = json.loads((ROOT / 'src/_data/schedule.json').read_text())['sessions']
        expected_ids = {'session-' + session['id'] for session in sessions}
        actual_ids = {value for value in schedule_page.ids if value.startswith('session-')} if schedule_page else set()
        if expected_ids != actual_ids:
            issues.setdefault('schedule/index.html', []).append('Preserved schedule sessions are missing or unexpected')
    if '/news/' in expected:
        source_pages = json.loads((ROOT / 'src/_data/wordpress.json').read_text())['pages']
        news = pages.get(site / 'news/index.html')
        for post in (p for p in source_pages if p['type'] == 'post'):
            if news is None or post['url'] not in news.urls:
                issues.setdefault('news/index.html', []).append('Missing post: ' + post['url'])
        try:
            sitemap = ET.parse(site / 'sitemap.xml')
            locations = [node.text for node in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
            expected_locations = {'https://forum2017.diglib.org' + p['url'] for p in source_pages}
            if set(locations) != expected_locations or len(locations) != len(expected_locations):
                issues.setdefault('sitemap.xml', []).append('Sitemap does not match preserved routes')
        except (OSError, ET.ParseError):
            issues.setdefault('sitemap.xml', []).append('Missing or invalid sitemap')
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
