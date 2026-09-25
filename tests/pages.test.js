import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newsIndex, enhancePage, description} from '../lib/pages.js';
import Sitemap from '../src/sitemap.11ty.js';
const wordpress = JSON.parse(readFileSync(new URL('../src/_data/wordpress.json', import.meta.url)));

test('news index includes every preserved post in date order', () => {
  const posts = wordpress.pages.filter(p=>p.type==='post').sort((a,b)=>b.date.localeCompare(a.date));
  const html = newsIndex(wordpress.pages);
  assert.equal((html.match(/<article>/g)||[]).length, 16);
  let position = -1;
  for(const post of posts) { const next = html.indexOf(`href="${post.url}"`); assert.ok(next > position); position = next; }
});

test('metadata and semantics preserve anchors and replace remote fonts', () => {
  const source = '<!doctype html><html><head><title>Old</title><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto"></head><body><h1 class="logo"><a href="/"><img alt="DLF Forum 2017"></a></h1><main id="main"><h2>Title</h2><h4 id="section">Section</h4><table><tr><th>Name</th></tr></table><iframe id="player"></iframe><iframe id="player"></iframe></main></body></html>';
  const result = enhancePage(source, {title:'A & B',url:'/example/',body:'Example text'}, wordpress.pages);
  assert.ok(result.includes('<h1>Title</h1>'));
  assert.ok(result.includes('<h2 id="section">Section</h2>'));
  assert.ok(result.includes('<div class="logo">'));
  assert.ok(result.includes('scope="col"'));
  assert.ok(result.includes('id="player-2"'));
  assert.ok(result.includes('title="Recording: Section"'));
  assert.ok(result.includes('/assets/fonts/fonts.css'));
  assert.ok(!result.includes('fonts.googleapis.com'));
  assert.equal((result.match(/name="description"/g)||[]).length, 1);
  assert.ok(result.includes('alt="DLF Forum 2017"'));
});

test('descriptions are nonempty and bounded; sitemap contains preserved URLs only', () => {
  for(const page of wordpress.pages) { assert.ok(description(page).length > 20); assert.ok(description(page).length <= 160); }
  const xml = new Sitemap().render({wordpress});
  assert.equal((xml.match(/<loc>/g)||[]).length, 124);
  assert.ok(!xml.includes('404.html'));
  assert.ok(xml.includes('https://forum2017.diglib.org/news/'));
});

test('local font files have valid signatures and match recorded checksums', async () => {
  const {createHash} = await import('node:crypto');
  const root = new URL('../src/assets/fonts/', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('provenance.json', root)));
  for(const file of manifest.files) {
    const bytes = readFileSync(new URL(file.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    if(file.file.endsWith('.woff2')) assert.equal(bytes.subarray(0,4).toString(), 'wOF2');
  }
  const css = readFileSync(new URL('fonts.css', root), 'utf8');
  assert.ok(!/https?:\/\//.test(css));
  assert.ok(css.includes('font-display: swap'));
});


test('sibling legacy headings remain siblings after skipped levels are normalized', () => {
  const result = enhancePage('<html><head></head><body><main><h2>Page</h2><h4>First table</h4><h4>Second table</h4><h4>Third table</h4></main></body></html>', {title:'Page',url:'/fixture/',body:''}, []);
  assert.equal((result.match(/<h2>/g)||[]).length, 3);
  assert.ok(!result.includes('<h3>'));
});
