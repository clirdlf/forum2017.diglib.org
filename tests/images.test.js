import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, stat, copyFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {createImagePipeline} from '../lib/images.js';

test('responsive pipeline preserves originals, removes duplicate heroes, and produces real bounded variants', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'archive-images-'));
  try {
    await mkdir(path.join(root, 'src/uploads'), {recursive: true});
    await mkdir(path.join(root, 'data'));
    const pixels = Buffer.alloc(2048 * 256 * 3);
    let seed = 42;
    for (let i = 0; i < pixels.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels[i] = seed >>> 24; }
    const original = path.join(root, 'src/uploads/photo.png');
    await sharp(pixels, {raw: {width: 2048, height: 256, channels: 3}}).png().toFile(original);
    const before = await readFile(original);
    const url = '/wp-content/uploads/sites/15/photo.png';
    const html = `<div class="hero__images"><img src="${url}" class="background_image background_image_desktop" alt=""><img src="${url}" class="background_image background_image_mobile" alt=""></div><p>Keep &amp; preserve</p><img src="${url}" alt="Description" width="300" height="38">`;
    const pipeline = createImagePipeline({root});
    await copyFile(original, path.join(root, 'src/uploads/alias.png'));
    const [output] = await Promise.all([pipeline.transform(html), pipeline.transform('<img src="/wp-content/uploads/sites/15/alias.png" alt="Alias">')]);
    assert.equal((output.match(/<img /g) || []).length, 2);
    assert.equal((output.match(/fetchpriority="high"/g) || []).length, 1);
    assert.ok(output.includes('loading="lazy"'));
    assert.ok(output.includes('width="2048" height="256"'));
    assert.ok(output.includes('width="300" height="38"'));
    assert.ok(output.includes(`src="${url}"`));
    assert.ok(output.includes('<p>Keep &amp; preserve</p>'));
    const report = await pipeline.report();
    assert.equal(report.duplicatesRemoved, 1);
    const variants = report.images[url].variants;
    assert.deepEqual(report.images['/wp-content/uploads/sites/15/alias.png'].variants, variants);
    assert.equal(variants.at(-1).width, 1920);
    for (const variant of variants) {
      const file = path.join(root, '_site', variant.url);
      assert.equal((await sharp(file).metadata()).width, variant.width);
      assert.ok((await stat(file)).size < before.length);
    }
    assert.deepEqual(await readFile(original), before);
    assert.equal(await createImagePipeline({root}).transform(html), output);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('leaves remote images and authored picture elements alone', async () => {
  const pipeline = createImagePipeline();
  const html = '<picture><source srcset="art.webp"><img src="/wp-content/uploads/sites/15/missing.jpg"></picture><img src="https://example.org/image.jpg">';
  assert.equal(await pipeline.transform(html), html);
});
