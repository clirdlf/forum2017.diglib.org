"""Preserve captured public WordPress markup, without plugins or server-side dependencies.
Run after scripts/import-wordpress.py. Raw captures live in ignored data/rendered.
"""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit
import html,json,re
from archive_html import adapt
ROOT=Path(__file__).resolve().parents[1]
VOID=set('area base br col embed hr img input link meta param source track wbr'.split())
class Capture(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False);self.out=[];self.stack=[];self.suppress=False
    def handle_starttag(self,tag,attrs):
        d=dict(attrs); marker=d.get('id','')+' '+d.get('class','')
        drop=any(s in marker for s in ('pojo-','wpa-','wp-accessibility','is-search','is-menu','monsterinsights'))
        if tag=='script':drop=d.get('id')!='embed-sched-js'
        if tag=='link':drop=d.get('rel') not in ('stylesheet','icon','apple-touch-icon','canonical') or any(s in d.get('href','') for s in ('/plugins/','wp-json'))
        if tag=='form':drop=True
        if tag=='style' and d.get('id','').startswith(('wp-emoji','wpa-')):drop=True
        if tag not in VOID:self.stack.append((tag,self.suppress));self.suppress=self.suppress or drop
        elif drop:return
        if self.suppress:return
        parts=[]
        if tag=='script' and d.get('id')=='embed-sched-js':parts.append('defer')
        for key,value in attrs:
            if key.startswith('on'):continue
            if value is None:parts.append(key);continue
            value=value.replace('https://forum2017.diglib.org','').replace('http://forum2017.diglib.org','') if key not in ('href',) or d.get('rel')!='canonical' else value
            if 'admin-ajax.php?action=dynamic-css' in value:value='/assets/fudge-dynamic.css'
            value=value.replace('/wp-content/themes/fudge-2/assets/','/assets/fudge-2/').replace('/wp-content/themes/fudge2-child/','/assets/fudge2-child/')
            value=value.replace('/wp-admin/twitter.com/','https://twitter.com/').replace('/wp-admin/“https:/www.imls.gov“','https://www.imls.gov/')
            if value=='/visitors-guide/':value='/hotel-and-travel/visitors-guide/'
            parts.append(f'{key}="{html.escape(value,quote=True)}"')
        self.out.append('<'+tag+(' '+' '.join(parts) if parts else '')+'>')
    def handle_endtag(self,tag):
        if tag in VOID:return
        if not self.suppress:
            if tag=='head':self.out.append('<link rel="stylesheet" href="/assets/static-theme.css"><script src="/assets/static-theme.js" defer></script>')
            self.out.append('</'+tag+'>')
        for n in range(len(self.stack)-1,-1,-1):
            if self.stack[n][0]==tag:
                self.suppress=self.stack[n][1];self.stack=self.stack[:n];break
    def handle_data(self,data):
        if not self.suppress:
            if self.stack and self.stack[-1][0]=='style' and ('pojo-' in data or 'wpa-' in data):return
            self.out.append(data.replace('https://forum2017.diglib.org/wp-content/uploads/','/wp-content/uploads/'))
    def handle_entityref(self,name):
        if not self.suppress:self.out.append('&'+name+';')
    def handle_charref(self,name):
        if not self.suppress:self.out.append('&#'+name+';')
    def handle_decl(self,decl):self.out.append('<!'+decl+'>')
data_path=ROOT/'src/_data/wordpress.json';data=json.loads(data_path.read_text());count=0;failed=[]
for page in data['pages']:
    source=ROOT/'data/rendered'/f'{page["id"]}.html'
    if not source.exists():failed.append(page['url']);continue
    raw=source.read_text()
    if 'site__content' not in raw:failed.append(page['url']);continue
    parser=Capture();parser.feed(raw);result=''.join(parser.out)
    # Decode public Cloudflare-obfuscated email links locally, eliminating its runtime script.
    def email(m):
        b=bytes.fromhex(m[1]);return 'mailto:'+html.escape(''.join(chr(c^b[0]) for c in b[1:]),quote=True)
    result=re.sub(r'/cdn-cgi/l/email-protection#([a-fA-F0-9]+)',email,result)
    def email_element(m):
        b=bytes.fromhex(m[2]); address=''.join(chr(c^b[0]) for c in b[1:]); label=html.escape(address)
        return '<a href="mailto:'+html.escape(address,quote=True)+'">'+label+'</a>' if m[1]=='a' else label
    result=re.sub(r'<(a|span)\b[^>]*data-cfemail="([a-fA-F0-9]+)"[^>]*>.*?</\1>',email_element,result,flags=re.S)
    result=result.replace('src="//dlfforum2017.sched.com/', 'src="https://dlfforum2017.sched.com/')
    if 'id="sched-embed"' in result:
        result=result.replace('<a id="sched-embed"', '<p class="schedule-direct"><a href="https://dlfforum2017.sched.com/">Open the full conference schedule</a></p><a id="sched-embed"')
    # Repair historical fragment links against their actual content targets.
    if page['url'] == '/thank-you/':
        result=result.replace('<h4>2017 Forum Planning Committee Volunteers:', '<h4 id="Forum">2017 Forum Planning Committee Volunteers:')
    if page['url'] == '/about-fellowships/fellows/':
        result=result.replace('<h2 class="site__title">HBCU Fellows', '<h2 class="site__title" id="HBCU">HBCU Fellows')
    if page['url'] == '/about-fellowships/':
        result=result.replace('<span>With thanks to our fellowship partners:', '<span id="partners">With thanks to our fellowship partners:')
    page['rendered']=adapt(result);count+=1
# Noncaptured archive-only routes remain available through the original importer.
data_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
(ROOT/'data/rendered-report.json').write_text(json.dumps({'captured':count,'fallbackRoutes':failed},indent=2)+'\n')
print(f'Preserved {count} original page layouts; {len(failed)} fallback routes')
