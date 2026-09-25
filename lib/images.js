import {parseDocument} from 'htmlparser2';
import sharp from 'sharp';
import {createHash, randomUUID} from 'node:crypto';
import {readFile, mkdir, copyFile, stat, writeFile, rename} from 'node:fs/promises';
import path from 'node:path';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attributes = attrs => Object.entries(attrs).map(([key, value]) => ` ${key}="${escape(value)}"`).join('');
const classes = node => (node.attribs?.class || '').split(/\s+/);
const hasAncestor = (node, className) => {
  for (let parent = node.parent; parent; parent = parent.parent) if (classes(parent).includes(className)) return true;
  return false;
};

export function createImagePipeline({root = process.cwd(), output = '_site', cache = '.cache/images'} = {}) {
  const pending = new Map();
  const inventory = new Map();
  const artifacts = new Map();
  let lazyImages = 0;
  let duplicatesRemoved = 0;

  async function imageFor(url) {
    if (!url?.startsWith('/wp-content/uploads/sites/15/') || !/\.(jpe?g|png|webp)$/i.test(url)) return null;
    if (pending.has(url)) return pending.get(url);
    const work = (async () => {
      const uploadRoot = path.resolve(root, 'src/uploads');
      const source = path.resolve(uploadRoot, decodeURIComponent(url.slice('/wp-content/uploads/sites/15/'.length)));
      if (!source.startsWith(uploadRoot + path.sep)) throw new Error('Image path outside uploads');
      const input = await readFile(source);
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height || meta.pages > 1) return null;
      const rotated = [5, 6, 7, 8].includes(meta.orientation);
      const width = rotated ? meta.height : meta.width;
      const height = rotated ? meta.width : meta.height;
      const result = {width, height, originalBytes: input.length, variants: []};
      // Small images benefit from dimensions/loading attributes without re-encoding.
      if (input.length >= 12000) {
        const hash = createHash('sha256').update(input).update('webp-q80-v2-' + sharp.versions.sharp + '-' + sharp.versions.vips).digest('hex').slice(0, 20);
        const widths = [...new Set([480, 768, 1200, 1920].filter(w => w < width).concat(Math.min(width, 1920)))];
        await mkdir(path.resolve(root, cache), {recursive: true});
        await mkdir(path.resolve(root, output, 'assets/optimized'), {recursive: true});
        for (const size of widths) {
          const filename = `${hash}-${size}.webp`;
          const cached = path.resolve(root, cache, filename);
          if (!artifacts.has(filename)) artifacts.set(filename, (async () => {
            try { await stat(cached); } catch (error) {
              if (error.code !== 'ENOENT') throw error;
              // Atomic writes also prevent an interrupted build leaving a partial cache entry.
              const temporary = cached + '.' + randomUUID() + '.tmp';
              await sharp(input).autoOrient().resize({width: size, withoutEnlargement: true}).webp({quality: 80}).toFile(temporary);
              await rename(temporary, cached);
            }
            return (await stat(cached)).size;
          })());
          const bytes = await artifacts.get(filename);
          // Never advertise an alternative larger than the original file.
          if (bytes < input.length) {
            await copyFile(cached, path.resolve(root, output, 'assets/optimized', filename));
            result.variants.push({width: size, bytes, url: '/assets/optimized/' + filename});
          }
        }
      }
      inventory.set(url, result);
      return result;
    })();
    pending.set(url, work);
    return work;
  }

  async function transform(html) {
    const document = parseDocument(html, {withStartIndices: true, withEndIndices: true, decodeEntities: true});
    const nodes = [];
    function walk(node) {
      if (node.name === 'img') nodes.push(node);
      for (const child of node.children || []) walk(child);
    }
    walk(document);
    const edits = [];
    const heroSources = new Map();
    let firstContentImage = true;
    for (const node of nodes) {
      // Do not alter any explicitly authored picture/art-direction markup.
      if (node.parent?.name === 'picture') continue;
      const attrs = {...node.attribs};
      const hero = hasAncestor(node, 'hero__images');
      const logo = hasAncestor(node, 'logo');
      if (hero) {
        const group = node.parent;
        if (!heroSources.has(group)) heroSources.set(group, new Set());
        if (heroSources.get(group).has(attrs.src)) {
          edits.push([node.startIndex, node.endIndex + 1, '']);
          duplicatesRemoved++;
          continue;
        }
        heroSources.get(group).add(attrs.src);
      }
      const data = await imageFor(attrs.src);
      if (!data) continue;
      if (!attrs.width || !attrs.height) {
        attrs['data-archive-intrinsic'] = 'true';
        attrs.width = String(data.width);
        attrs.height = String(data.height);
      }
      const eager = logo || hero || firstContentImage;
      if (!logo) firstContentImage = false;
      attrs.loading = eager ? 'eager' : 'lazy';
      attrs.decoding = 'async';
      delete attrs.fetchpriority;
      if (hero) {
        attrs.fetchpriority = 'high';
        attrs.class = classes(node).filter(c => !/^background_image_(desktop|tablet|mobile)$/.test(c)).concat('archive-responsive-hero').join(' ');
      }
      if (!eager) lazyImages++;
      const img = `<img${attributes(attrs)}>`;
      const sizes = hero ? '100vw' : attrs.sizes || `(max-width: ${Math.min(Number(attrs.width), 1120)}px) 100vw, ${Math.min(Number(attrs.width), 1120)}px`;
      const srcset = data.variants.map(variant => `${variant.url} ${variant.width}w`).join(', ');
      const replacement = srcset ? `<picture class="archive-picture"><source type="image/webp" srcset="${escape(srcset)}" sizes="${escape(sizes)}">${img}</picture>` : img;
      edits.push([node.startIndex, node.endIndex + 1, replacement]);
    }
    for (const [start, end, replacement] of edits.sort((a, b) => b[0] - a[0])) html = html.slice(0, start) + replacement + html.slice(end);
    return html;
  }

  async function report() {
    const images = Object.fromEntries([...inventory].sort(([a], [b]) => a.localeCompare(b)));
    const values = Object.values(images);
    const originalBytes = values.reduce((sum, image) => sum + image.originalBytes, 0);
    const largestAlternativeBytes = values.reduce((sum, image) => sum + (image.variants.at(-1)?.bytes ?? image.originalBytes), 0);
    const data = {uniqueImages: values.length, lazyImages, duplicatesRemoved, originalBytes, largestAlternativeBytes,
      note: 'Comparison of unique referenced originals with their largest advertised alternatives; not a measured page transfer size. Original upload URLs remain published.', images};
    await writeFile(path.resolve(root, 'data/asset-report.json'), JSON.stringify(data, null, 2) + '\n');
    return data;
  }
  return {transform, report};
}
