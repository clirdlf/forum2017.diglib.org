import {rm} from 'node:fs/promises';
import {createImagePipeline} from './lib/images.js';
export default function(eleventyConfig) {
  let images;
  eleventyConfig.on('eleventy.before', async () => {
    await rm('_site/assets/optimized', {recursive: true, force: true});
    images = createImagePipeline();
  });
  eleventyConfig.addTransform('responsive-images', async function(content) {
    return this.page.outputPath?.endsWith('.html') ? images.transform(content) : content;
  });
  eleventyConfig.on('eleventy.after', async () => {
    const report = await images.report();
    console.log(`Images: ${report.uniqueImages} unique, ${report.lazyImages} lazy-loaded; largest alternatives ${(report.largestAlternativeBytes / 1024 / 1024).toFixed(1)} MB vs ${(report.originalBytes / 1024 / 1024).toFixed(1)} MB originals`);
  });
  eleventyConfig.addPassthroughCopy('src/assets');
  eleventyConfig.addPassthroughCopy({'src/uploads': 'wp-content/uploads/sites/15'});
  eleventyConfig.addPassthroughCopy({'data/schedule/schedule.ics': 'assets/schedule.ics'});
  eleventyConfig.addWatchTarget('lib/');
  return {dir: {input: 'src', output: '_site', includes: '_includes', data: '_data'}};
}
