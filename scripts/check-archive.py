"""Audit generated pages without fetching external URLs or deleting assets."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json,re
ROOT=Path(__file__).resolve().parents[1]
site=ROOT/'_site'
missing={}; shortcodes=[]
class Links(HTMLParser):
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if not value: continue
            urls=[value] if key in ('src','href','poster') else [part.strip().split()[0] for part in value.split(',') if part.strip()] if key=='srcset' else []
            for url in urls:
                parsed=urlsplit(url)
                if parsed.netloc or parsed.scheme or not parsed.path: continue
                path=unquote(parsed.path)
                target=(site/path.lstrip('/')) if path.startswith('/') else self.page.parent/path
                if not target.is_file() and not (target/'index.html').is_file(): missing.setdefault(url,set()).add('/'+str(self.page.relative_to(site)))
for page in site.rglob('*.html'):
    parser=Links(); parser.page=page; source=page.read_text(); parser.feed(source)
    if re.search(r'\[/?(?:efcb-section-|woocommerce_|sched\s)',source): shortcodes.append(str(page.relative_to(site)))
php=list(site.rglob('*.php'))
report={'missingLocalReferences':{k:sorted(v) for k,v in sorted(missing.items())},'unrenderedShortcodePages':shortcodes,'publishedPHP':[str(p.relative_to(site)) for p in php]}
(ROOT/'data/link-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'{len(list(site.rglob("*.html")))} pages checked; {len(missing)} missing local references; {len(shortcodes)} pages with raw shortcodes; {len(php)} PHP files')
if shortcodes or php: raise SystemExit(1)
