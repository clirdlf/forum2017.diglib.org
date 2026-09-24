"""One-time/repeatable WXR import; only public content goes into Eleventy data."""
from pathlib import Path
import collections, html, json, re, xml.etree.ElementTree as ET
from urllib.parse import urlsplit
ROOT = Path(__file__).resolve().parents[1]
NS = {'wp': 'http://wordpress.org/export/1.2/', 'content': 'http://purl.org/rss/1.0/modules/content/'}
def escape(value): return html.escape(str(value), quote=True)
def local(value): return re.sub(r'https?://forum2017\.diglib\.org(?=/|$)', '', value.strip())
items = []
for node in ET.parse(ROOT/'data/dlfforum2017.WordPress.2026-09-24.xml').findall('./channel/item'):
    def get(name): return node.findtext(name, default='', namespaces=NS) or ''
    items.append(dict(id=get('wp:post_id'), type=get('wp:post_type'), status=get('wp:status'), title=html.unescape(get('title')), url=local(get('link')), body=get('content:encoded'), date=get('wp:post_date'), order=int(get('wp:menu_order') or 0), attachment=local(get('wp:attachment_url')), meta={m.findtext('wp:meta_key',namespaces=NS):m.findtext('wp:meta_value',default='',namespaces=NS) for m in node.findall('wp:postmeta',NS)}, menus=[c.get('nicename') for c in node.findall('category') if c.get('domain')=='nav_menu']))
by_id={i['id']:i for i in items}
public_types={'page','post','sponsor','speaker','session','exhibitor','poi','ticket'}
public=[i for i in items if i['status']=='publish' and i['type'] in public_types]
issues=[]
current=''
def issue(kind, detail):
    record={'url':current,'kind':kind,'detail':detail}
    if record not in issues: issues.append(record)
def image_for(item):
    attachment=by_id.get(item['meta'].get('_thumbnail_id'),{})
    return attachment.get('attachment','')
def cards(ids, kind):
    result=[]
    for ident in ids:
        item=by_id.get(ident)
        if not item or item not in public:
            if ident: issue('missing-entity',ident)
            continue
        image=image_for(item)
        url=local(item['meta'].get('sponsor_link') or item['meta'].get('exhibitor_link') or item['url'])
        result.append(f'<article class="archive-card"><a href="{escape(url)}">'+(f'<img loading="lazy" src="{escape(image)}" alt="">' if image else '')+f'<h3>{escape(item["title"])}</h3></a></article>')
    return '<div class="archive-cards '+escape(kind)+'">'+''.join(result)+'</div>'
# Restrict recognition to actual shortcode names; leave bracketed prose and scripts alone.
TOKEN=re.compile(r'\[(/?)(efcb-section-[\w-]+|content|text|subtitle|embed_code|sched(?:\.com|\.org)?|woocommerce_\w+)(?=[\s\]/])([^\]]*)\]')
ATTR=re.compile(r'''([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))''')
def attrs(raw): return {m[0]:html.unescape(next(v for v in m[1:] if v!='') if any(m[1:]) else '').strip() for m in ATTR.findall(raw)}
def render_section(name,a,body):
    if name in ('content','text','subtitle','embed_code'): return body
    if name.startswith('sched'):
        url=a.get('url',''); parsed=urlsplit(url)
        if parsed.scheme not in ('http','https') or not (parsed.hostname or '').endswith('.sched.com'):
            issue('invalid-sched-url',url); return body
        issue('external-service','Sched embed requires '+parsed.hostname)
        return f'<div class="archive-sched"><a id="sched-embed" href="{escape(url)}">View the conference schedule</a><script src="https://{escape(parsed.hostname)}/js/embed.js" defer></script></div>'
    if name.startswith('woocommerce_'):
        issue('retired-interaction',name)
        return '<p>This conference has ended. Online purchasing and account access are no longer available on this archive.</p>'
    kind=name.removeprefix('efcb-section-')
    title=a.get('title') or (a.get('text','') if kind in ('headline','heading') else '')
    heading=f'<h2>{escape(title)}</h2>' if title else ''
    subtitle=f'<p>{escape(a["subtitle"])}</p>' if a.get('subtitle') else ''
    entities=a.get('entities','').split(',')
    style=''
    if re.fullmatch(r'#[0-9a-fA-F]{3,8}',a.get('background_color','')): style='background-color:'+a['background_color']+';'
    if kind=='conference':
        bg=local(a.get('background_image_desktop',''))
        picture=f'<img class="archive-hero-image" src="{escape(bg)}" alt="">' if bg else ''
        button=f'<a class="archive-button" href="{escape(local(a.get("view_url","")))}">{escape(a.get("view_text",""))}</a>' if a.get('hide_register_button')!='yes' and a.get('view_url') else ''
        return f'<section class="archive-hero">{picture}<div>{heading}<p>{escape(a.get("datetext",""))} {escape(a.get("location",""))}</p>{button}</div></section>'
    if kind in ('fullsponsors','speakers','fullspeakers','exhibitors','news','map','fulltickets'):
        if kind=='news' and not any(entities): entities=[i['id'] for i in sorted(public,key=lambda i:i['date'],reverse=True) if i['type']=='post']
        body+=cards(entities,kind)
        if kind=='map': issue('simplified-section','Map replaced with links to exported venue records')
    elif kind=='generic':
        body+='<div class="archive-cards">'+''.join(f'<a class="archive-button" href="{escape(local(a.get(f"section_{n}_url","#")))}">{escape(a.get(f"section_{n}_text",""))}</a>' for n in range(1,4) if a.get(f'section_{n}_text'))+'</div>'
    elif kind in ('calltoaction','calltoaction-small'):
        if a.get('image'): body+=f'<img loading="lazy" src="{escape(local(a["image"]))}" alt="">'
        if a.get('button_url'): body+=f'<a class="archive-button" href="{escape(local(a["button_url"]))}">{escape(a.get("button_text","Learn more"))}</a>'
    elif kind in ('social','followus','twitter-wrap','newsletter','timer'):
        issue('needs-review',kind+' depends on theme options or retired interaction')
        if kind in ('newsletter','timer','twitter-wrap'): return ''
        return body
    elif kind not in ('html','event-description','samplepage','headline','heading'):
        issue('unsupported-section',kind)
        # Preserve content even when the original component cannot yet be reconstructed.
    return f'<section class="archive-section archive-{escape(kind)}" style="{escape(style)}">{heading}{subtitle}{body}</section>'
def render(raw):
    # WordPress inserted paragraphs around shortcode boundaries; remove only those wrappers.
    raw=re.sub(r'<p>\s*((?:\[(?:/?efcb-section-[^\]]+|/?content)\]\s*)+)</p>',r'\1',raw)
    stack=[['',{},[]]]
    pos=0
    for m in TOKEN.finditer(raw):
        stack[-1][2].append(raw[pos:m.start()]); pos=m.end()
        closing,name,arguments=m.groups()
        if closing:
            if len(stack)>1 and stack[-1][0]==name:
                tag,a,parts=stack.pop(); stack[-1][2].append(render_section(tag,a,''.join(parts)))
            else: issue('unmatched-shortcode',m.group())
        elif name.startswith('sched') or name.startswith('woocommerce_') or arguments.rstrip().endswith('/'):
            stack[-1][2].append(render_section(name,attrs(arguments),''))
        else: stack.append([name,attrs(arguments),[]])
    stack[-1][2].append(raw[pos:])
    while len(stack)>1:
        tag,a,parts=stack.pop(); issue('unclosed-shortcode',tag); stack[-1][2].append(render_section(tag,a,''.join(parts)))
    result=''.join(stack[0][2])
    result=re.sub(r'https?://forum2017\.diglib\.org(?=/)', '',result)
    result=result.replace('/wp-admin/twitter.com/', 'https://twitter.com/')
    result=result.replace('/wp-admin/“https:/www.imls.gov“', 'https://www.imls.gov/')
    result=result.replace('href="/visitors-guide/"', 'href="/hotel-and-travel/visitors-guide/"')
    result=re.sub(r'<p>\s*</p>','',result)
    return result
pages=[]
for item in public:
    current=item['url']
    parsed=urlsplit(current)
    if parsed.query or not current.startswith('/') or '..' in parsed.path.split('/'): raise ValueError('Unsafe permalink: '+current)
    body=render(item['body'])
    if item['type']=='poi' and item['meta'].get('poi_address'):
        body+=f'<p>{escape(item["meta"]["poi_address"])}</p>'
    if item['type']=='session':
        issue('needs-review','Exported session metadata may include theme demo content; not treated as the Sched program')
    if item['type']=='ticket':
        issue('needs-review','Exported ticket may be theme demo content; no purchase interaction generated')
    if not body.strip(): issue('empty-content',item['title'])
    pages.append({k:item[k] for k in ('id','title','url','type','date')} | {'body':body,'image':image_for(item)})
menus={}
for item in sorted(items,key=lambda i:i['order']):
    if item['type']!='nav_menu_item' or item['status']!='publish': continue
    target=by_id.get(item['meta'].get('_menu_item_object_id'),{})
    url=local(item['meta'].get('_menu_item_url') or target.get('url',''))
    if not url: continue
    for menu in item['menus']:
        menus.setdefault(menu,[]).append({'id':item['id'],'parent':item['meta'].get('_menu_item_menu_item_parent','0'),'title':item['title'] or target.get('title',''),'url':url})
output=ROOT/'src/_data/wordpress.json'; output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps({'pages':pages,'menus':menus},ensure_ascii=False,indent=2)+'\n')
css='\n'.join(i['body'] for i in items if i['type']=='custom_css' and i['status']=='publish')
(ROOT/'src/assets/wordpress-custom.css').write_text(css)
(ROOT/'data/migration-report.json').write_text(json.dumps({'counts':dict(collections.Counter(i['type'] for i in public)),'issues':issues},indent=2)+'\n')
print(f'Imported {len(pages)} pages; {len(issues)} review items in data/migration-report.json')
