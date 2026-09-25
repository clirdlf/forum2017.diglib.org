import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSchedule, replaceScheduleEmbed} from '../lib/schedule.js';
const schedule = JSON.parse(readFileSync(new URL('../src/_data/schedule.json', import.meta.url)));

test('renders all sessions with local date anchors and source links', () => {
  const html = renderSchedule(schedule);
  assert.equal((html.match(/<details /g) || []).length, 151);
  for (const session of schedule.sessions) {
    assert.ok(html.includes(`id="session-${session.id}"`));
    assert.ok(html.includes(session.sourceUrl));
  }
  assert.ok(html.includes('8:00 AM'));
  assert.ok(html.includes('Sunday, October 22'));
});

test('replaces remote runtime with local navigation on the homepage', () => {
  const html = replaceScheduleEmbed('<p class="schedule-direct">Old</p><a id="sched-embed" href="https://dlfforum2017.sched.com/">Sched</a><script id="embed-sched-js" src="https://dlfforum2017.sched.com/js/embed.js"></script>', {url: '/'}, schedule);
  assert.ok(html.includes('/schedule/#day-2017-10-22'));
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('<details'));
});

test('escapes imported content and does not interpret HTML or script URLs', () => {
  const fixture = structuredClone(schedule);
  fixture.sessions = [{...schedule.sessions[0], title: '<script>bad</script>', description: '<img src=x onerror=alert(1)> javascript:alert(1) https://example.org/?a=1&b=2'}];
  const html = renderSchedule(fixture);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(html.includes('href="https://example.org/?a=1&amp;b=2"'));
});
