export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy('src/assets');
  eleventyConfig.addPassthroughCopy({'src/uploads': 'wp-content/uploads/sites/15'});
  return {dir: {input: 'src', output: '_site', includes: '_includes', data: '_data'}};
}
