"""Small, deterministic accessibility and static-archive adaptations to captures."""
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
VOID = set('area base br col embed hr img input link meta param source track wbr'.split())
NOTICE = (ROOT / 'src/_includes/archive-notice.html').read_text()
VENUE = '''<section id="map" class="archive-venue" aria-labelledby="archive-venue-title">
<h2 id="archive-venue-title">2017 conference venue</h2>
<p>The Westin Convention Center<br>1000 Penn Avenue, Pittsburgh, PA 15222</p>
<p><a href="https://www.google.com/maps/search/?api=1&amp;query=1000+Penn+Avenue+Pittsburgh+PA+15222">View the venue address on Google Maps</a></p></section>'''
SOCIAL = {'twitter.com': 'DLF on Twitter', 'www.facebook.com': 'DLF on Facebook',
          'www.instagram.com': 'DLF on Instagram', 'www.linkedin.com': 'DLF on LinkedIn'}

class ArchiveHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out = []
        self.stack = []
        self.suppressed = False

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        classes = d.get('class', '').split()
        original = tag
        previous = self.suppressed
        drop = 'subscribe' in classes or (tag == 'a' and d.get('href') == '#')
        if 'where' in classes:
            if not previous:
                self.out.append(VENUE)
            drop = True
        self.suppressed = previous or drop
        if 'site__content' in classes:
            tag = 'main'
            d.update(id='main', tabindex='-1')
        if tag == 'nav' and 'header-menu' in classes:
            d.update(id='archive-navigation', **{'aria-label': 'Main navigation'})
        if tag == 'button' and 'menu-btn' in classes:
            d.update(type='button', hidden=None, **{'aria-label': 'Toggle navigation',
                     'aria-controls': 'archive-navigation', 'aria-expanded': 'false'})
        if tag == 'img' and 'alt' not in d:
            # The audited missing alternatives are decorative hero/background images.
            if any(c.startswith(('background_image', 'register-now__')) for c in classes):
                d['alt'] = ''
        if tag == 'a':
            href = d.get('href', '')
            if d.get('rel') == 'home':
                d['href'] = '/'
            if any('social' in entry[3] for entry in self.stack):
                label = 'Email DLF' if href.startswith('mailto:') else SOCIAL.get(urlsplit(href).netloc)
                if label:
                    d['aria-label'] = label
        if tag == 'i' and 'fa' in classes:
            d['aria-hidden'] = 'true'
        if tag not in VOID:
            self.stack.append((original, tag, previous, classes))
        if not self.suppressed:
            attributes = ''.join(' ' + k if v is None else f' {k}="{escape(v, quote=True)}"' for k, v in d.items())
            self.out.append(f'<{tag}{attributes}>')
            if tag == 'body':
                self.out.append('<a class="skip-link" href="#main">Skip to content</a>' + NOTICE)
        if tag in VOID:
            self.suppressed = previous

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            original, output, previous, _ = self.stack[i]
            if original == tag:
                if not self.suppressed:
                    self.out.append(f'</{output}>')
                self.suppressed = previous
                self.stack = self.stack[:i]
                break

    def handle_data(self, data):
        if not self.suppressed:
            self.out.append(data)

    def handle_entityref(self, name):
        self.handle_data('&' + name + ';')

    def handle_charref(self, name):
        self.handle_data('&#' + name + ';')

    def handle_decl(self, decl):
        self.out.append('<!' + decl + '>')


def adapt(source):
    parser = ArchiveHTML()
    parser.feed(source)
    parser.close()
    return ''.join(parser.out)
