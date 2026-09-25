import {escape} from '../lib/pages.js';
export default class {
  data() { return {permalink:'/sitemap.xml', eleventyExcludeFromCollections:true}; }
  render({wordpress}) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...wordpress.pages].sort((a,b)=>a.url.localeCompare(b.url)).map(page=>`<url><loc>${escape('https://forum2017.diglib.org' + page.url)}</loc></url>`).join('\n') + '\n</urlset>\n';
  }
}
