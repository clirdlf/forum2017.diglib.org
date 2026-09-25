import {parseDocument} from 'htmlparser2';
export const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function text(node) {
  if (node.type === 'text') return node.data;
  if (['script', 'style'].includes(node.name)) return '';
  return (node.children || []).map(text).join(' ');
}
export const plain = html => text(parseDocument(html || '')).replace(/\s+/g, ' ').trim();
const excerpt = (value, limit = 190) => {
  const result = plain(value);
  return result.length <= limit ? result : result.slice(0, limit - 1).replace(/\s+\S*$/, '') + '…';
};
export function description(entry) {
  const special = {
    '/': 'Explore the preserved DLF Forum 2017 conference in Pittsburgh: the full schedule, speakers, news, recordings, and presentation repository.',
    '/news/': 'Browse all 16 news posts preserved from the DLF Forum 2017 website, including announcements, fellowships, and sponsor contributions.',
    '/schedule/': 'Browse 151 preserved DLF Forum 2017 sessions by day, with Pittsburgh times, locations, speaker names, and session descriptions.',
    '/404.html': 'This page could not be found in the DLF Forum 2017 archive. Find the schedule, news, speakers, recordings, or return to the homepage.',
  };
  if (special[entry.url]) return special[entry.url];
  const title = plain(entry.title);
  const body = plain(entry.body);
  const value = `${title} — DLF Forum 2017 archive.${body ? ' ' + body : ''}`;
  return value.length <= 160 ? value : value.slice(0, 156).replace(/\s+\S*$/, '') + '…';
}

export function newsIndex(pages) {
  const posts = pages.filter(page => page.type === 'post').sort((a, b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
  return `<div class="discovery-layout"><h1>News archive</h1><p>All ${posts.length} posts preserved from the original site, including earlier entries. Listed newest first.</p><ol class="news-index">${posts.map(post => `<li><article><time datetime="${escape(post.date.slice(0,10))}">${escape(post.date.slice(0,10))}</time><h2><a href="${escape(post.url)}">${escape(post.title)}</a></h2><p>${escape(excerpt(post.body))}</p></article></li>`).join('')}</ol></div>`;
}

export function enhancePage(html, entry, pages) {
  const root = parseDocument(html, {withStartIndices:true, withEndIndices:true});
  const nodes = [];
  const walk = node => { if(node.name && node.attribs) nodes.push(node); for(const child of node.children || []) walk(child); };
  walk(root);
  const edits = [];
  const replace = (start, end, value) => edits.push([start, end, value]);
  const main = nodes.find(node => node.name === 'main');
  const inMain = node => main && node.startIndex > main.startIndex && node.endIndex < main.endIndex;
  const attrs = new Map();
  const names = new Map();
  const getAttrs = node => { if(!attrs.has(node)) attrs.set(node, {...node.attribs}); return attrs.get(node); };
  const imageAlternatives = {
    'rebellion-2.jpg': 'Colonial America manuscript viewer highlighting the handwritten word “Rebellion” among search results.',
    'Nightingalehtr.jpg': 'Handwritten letter with “Nightingale” highlighted as a handwriting-search match.',
    'i2Sphoto.png': 'Library interior with rows of bookshelves beneath an ornate painted ceiling.',
    'i2Sphoto2-300x233.png': 'Limb Gallery promotional graphic showing import tools and a collection website displayed on a phone.',
  };
  const namedImage = node => node.name === 'img' && node.attribs.alt?.trim() || (node.children || []).some(namedImage);
  let lastLevel = 0;
  const headingStack = [{source: 0, output: 1}];
  let lastHeading = entry.title;
  const ids = new Set();
  for(const node of nodes) {
    const cls = (node.attribs.class || '').split(/\s+/);
    if(node.attribs.id) {
      let id = node.attribs.id, suffix = 2;
      while(ids.has(id)) id = `${node.attribs.id}-${suffix++}`;
      ids.add(id);
      if(id !== node.attribs.id) getAttrs(node).id = id;
    }
    if(node.name === 'link' && /fonts\.(googleapis|gstatic)\.com/.test(node.attribs.href || '')) {
      replace(node.startIndex, node.endIndex + 1, '');
      continue;
    }
    if(node.name === 'title') {
      replace(node.startIndex, node.endIndex + 1, `<title>${escape(entry.url === '/' ? 'DLF Forum 2017 archive' : plain(entry.title) + ' | DLF Forum 2017')}</title>`);
      continue;
    }
    if(node.name === 'img' && !node.attribs.alt) {
      const alternative = imageAlternatives[(node.attribs.src || '').split('/').pop()];
      if(alternative) getAttrs(node).alt = alternative;
    }
    if(node.name === 'table') {
      replace(node.startIndex, node.startIndex, `<div class="archive-table-scroll" role="region" tabindex="0" aria-label="${escape(lastHeading)} table">`);
      replace(node.endIndex + 1, node.endIndex + 1, '</div>');
    }
    if(node.name === 'meta' && node.attribs.name === 'description') {
      replace(node.startIndex, node.endIndex + 1, '');
      continue;
    }
    if(/^h[1-6]$/.test(node.name)) {
      if(cls.includes('logo')) { names.set(node, 'div'); continue; }
      if(inMain(node)) {
        let sourceLevel = Number(node.name[1]);
        if(cls.includes('speakers__name') || cls.includes('news__title')) sourceLevel = 3;
        let level = 1;
        if(lastLevel) {
          while(headingStack.length > 1 && headingStack.at(-1).source >= sourceLevel) headingStack.pop();
          level = Math.min(6, headingStack.at(-1).output + 1);
          headingStack.push({source:sourceLevel, output:level});
        }
        names.set(node, 'h' + level);
        lastLevel = level;
        lastHeading = text(node).replace(/\s+/g, ' ').trim();
      }
    }
    if(entry.url === '/thank-you/') {
      if(node.name === 'a' && cls.includes('features__item_2')) getAttrs(node).href = '#LAC-HBCU';
      if(node.name === 'a' && cls.includes('features__item_3')) getAttrs(node).href = '#NDSA';
      if(/^h[1-6]$/.test(node.name) && text(node).includes('LACs/HBCUs Pre-conference Planning Committee')) getAttrs(node).id = 'LAC-HBCU';
      if(/^h[1-6]$/.test(node.name) && text(node).includes('NDSA Digital Preservation 2017 Planning Committee')) getAttrs(node).id = 'NDSA';
    }
    if(node.name === 'iframe') {
      getAttrs(node).title = `Recording: ${lastHeading}`;
      getAttrs(node).loading = 'lazy';
    }
    if(node.name === 'th' && !node.attribs.scope) {
      const row = node.parent;
      const rows = row.parent?.children?.filter(child => child.name === 'tr') || [];
      if(rows[0] === row) getAttrs(node).scope = 'col';
    }
    if(node.name === 'a' && !text(node).trim() && !namedImage(node) && !node.attribs['aria-label']) {
      const linkedPage = pages.find(page => page.url === node.attribs.href);
      if(linkedPage) getAttrs(node)['aria-label'] = plain(linkedPage.title);
    }
  }
  if(main && !lastLevel) replace(html.indexOf('>', main.startIndex) + 1, html.indexOf('>', main.startIndex) + 1, `<h1 class="archive-content-title">${escape(entry.title)}</h1>`);
  for(const node of new Set([...attrs.keys(), ...names.keys()])) {
    const name = names.get(node) || node.name;
    const attributes = attrs.get(node) || node.attribs;
    const opening = '<' + name + Object.entries(attributes).map(([k,v]) => ` ${k}="${escape(v)}"`).join('') + '>';
    replace(node.startIndex, html.indexOf('>', node.startIndex) + 1, opening);
    if(names.has(node)) {
      const endStart = html.lastIndexOf('</', node.endIndex);
      replace(endStart, node.endIndex + 1, `</${name}>`);
    }
  }
  const headEnd = html.indexOf('</head>');
  replace(headEnd,headEnd,`<meta name="description" content="${escape(description(entry))}"><link rel="stylesheet" href="/assets/fonts/fonts.css"><link rel="stylesheet" href="/assets/discovery.css">`);
  for(const [start,end,value] of edits.sort((a,b)=>b[0]-a[0])) html=html.slice(0,start)+value+html.slice(end);
  return html;
}
