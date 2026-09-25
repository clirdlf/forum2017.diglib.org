export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets');
  eleventyConfig.addPassthroughCopy({'src/uploads': 'wp-content/uploads/sites/15'});
  eleventyConfig.addPassthroughCopy({'data/schedule/schedule.ics': 'assets/schedule.ics'});
  eleventyConfig.addWatchTarget('lib/');
  return {dir: {input: 'src', output: '_site', includes: '_includes', data: '_data'}};
}
