import {enhancePage} from './lib/pages.js';
import {readFileSync} from 'node:fs';
import {createImagePipeline} from './lib/images.js';
export default function(eleventyConfig) {
  let images;
  let pages;
  eleventyConfig.addTransform('metadata-accessibility', function(content) {
    if (!this.page.outputPath?.endsWith('.html')) return content;
    const entry = pages.find(page => page.url === this.page.url) || {url: this.page.url, title: 'Page not found', body: ''};
    return enhancePage(content, entry, pages);
  });
  eleventyConfig.on('eleventy.before', async () => {
    images = createImagePipeline();
    pages = JSON.parse(readFileSync('src/_data/wordpress.json', 'utf8')).pages;
  });
  eleventyConfig.addTransform('responsive-images', async function(content) {
    return this.page.outputPath?.endsWith('.html') ? images.transform(content) : content;
  });
  eleventyConfig.on('eleventy.after', async () => {
    const report = await images.report();
    console.log(`Images: ${report.uniqueImages} unique, ${report.lazyImages} lazy-loaded; largest alternatives ${(report.largestAlternativeBytes / 1024 / 1024).toFixed(1)} MB vs ${(report.originalBytes / 1024 / 1024).toFixed(1)} MB originals`);
  });
  eleventyConfig.addPassthroughCopy('src/assets');
  eleventyConfig.addPassthroughCopy('src/robots.txt');
  eleventyConfig.addPassthroughCopy({'src/uploads': 'wp-content/uploads/sites/15'});
  eleventyConfig.addPassthroughCopy({'data/schedule/schedule.ics': 'assets/schedule.ics'});
  eleventyConfig.addWatchTarget('lib/');
  return {dir: {input: 'src', output: '_site', includes: '_includes', data: '_data'}};
}
