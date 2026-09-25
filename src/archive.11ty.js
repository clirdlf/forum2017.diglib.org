const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function menu(items = [], parent = '0', seen = new Set()) {
  return '<ul>' + items.filter(i => i.parent === parent && !seen.has(i.id)).map(i => {
    const next = new Set(seen); next.add(i.id);
    return `<li><a href="${esc(i.url)}">${esc(i.title)}</a>${items.some(child => child.parent === i.id) ? menu(items, i.id, next) : ''}</li>`;
  }).join('') + '</ul>';
}
export default class {
  data() {
    return {pagination: {data: 'wordpress.pages', size: 1, alias: 'entry'}, permalink: data => data.entry.url};
  }
  render({entry, wordpress}) {
    if (entry.rendered) return entry.rendered;
    const home = entry.url === '/';
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(home ? 'DLF Forum 2017' : entry.title + ' | DLF Forum 2017')}</title>
<link rel="canonical" href="https://forum2017.diglib.org${esc(entry.url)}">
<link rel="stylesheet" href="/assets/fudge-2/css/main.css">
<link rel="stylesheet" href="/assets/fudge-2/css/font-awesome.min.css">
<link rel="stylesheet" href="/assets/fudge2-child/style.css">
<link rel="stylesheet" href="/assets/wordpress-custom.css">
<link rel="stylesheet" href="/assets/archive.css"></head>
<body class="archive-site"><a class="skip-link" href="#main">Skip to content</a>
<header class="archive-header"><a class="archive-brand" href="/">DLF Forum <strong>2017</strong></a>
<nav aria-label="Main navigation">${menu(wordpress.menus.header)}</nav></header>
<main id="main">${home ? '' : `<div class="archive-page-heading"><h1>${esc(entry.title)}</h1>${entry.type === 'post' ? `<time datetime="${esc(entry.date.slice(0,10))}">${esc(entry.date.slice(0,10))}</time>` : ''}</div>`}
${entry.type !== 'page' && entry.image ? `<img class="archive-featured" src="${esc(entry.image)}" alt="">` : ''}
<div class="archive-body ${entry.type === 'page' ? '' : 'archive-prose'}">${entry.body}</div></main>
<footer class="archive-footer"><p>DLF Forum 2017 · Pittsburgh, Pennsylvania</p><div class="archive-footer-menus">${Object.entries(wordpress.menus).filter(([name]) => name !== 'header').map(([name,items]) => `<nav aria-label="${esc(name)}"><h2>${esc(name)}</h2>${menu(items)}</nav>`).join('')}</div></footer></body></html>`;
  }
}
