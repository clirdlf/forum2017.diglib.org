const escape = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel = date => new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric'}).format(new Date(`${date}T12:00:00-04:00`));
const timeLabel = date => new Intl.DateTimeFormat('en-US', {timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit'}).format(new Date(date));

function description(text) {
  // Calendar descriptions are text, never executable source HTML.
  return text.split(/(https?:\/\/[^\s<>]+)/g).map(part => {
    if (!/^https?:\/\//.test(part)) return escape(part);
    const url = part.replace(/[.,;)]+$/, '');
    return `<a href="${escape(url)}">${escape(url)}</a>${escape(part.slice(url.length))}`;
  }).join('');
}

export function renderSchedule(schedule, full = true) {
  if (!schedule?.sessions?.length) throw new Error('The preserved schedule is missing');
  const dates = [...new Set(schedule.sessions.map(session => session.start.slice(0, 10)))];
  const links = dates.map(date => `<a href="${full ? '' : '/schedule/'}#day-${date}">${escape(dateLabel(date))}</a>`).join(' · ');
  const intro = `<section class="local-schedule" aria-label="Preserved conference schedule">
<p><strong>Preserved 2017 schedule</strong> · ${schedule.sessions.length} sessions · All times are Pittsburgh time (EDT).</p>
<nav class="schedule-days" aria-label="Schedule days">${links}</nav>`;
  if (!full) return `${intro}<p><a href="/schedule/">Browse all sessions, speakers, and descriptions</a></p></section>`;
  return `${intro}
<p>Captured from <a href="${escape(schedule.sourceUrl)}">the original Sched schedule</a> on ${escape(schedule.capturedAt.slice(0, 10))}. Historical titles and descriptions are preserved; linked resources remain external.</p>
<p><a href="/assets/schedule.ics" download>Download the preserved calendar (.ics)</a></p>
<p>Expand a session to read its description and source link.</p>
${dates.map(date => `<section class="schedule-day" aria-labelledby="day-${date}">
<h2 id="day-${date}">${escape(dateLabel(date))}</h2>
${schedule.sessions.filter(session => session.start.startsWith(date)).map(session => `<details class="schedule-session" id="session-${escape(session.id)}">
<summary><span class="schedule-time"><time datetime="${escape(session.start)}">${timeLabel(session.start)}</time>–<time datetime="${escape(session.end)}">${timeLabel(session.end)}</time></span><strong>${escape(session.title)}</strong></summary>
<div class="schedule-detail">
${session.location ? `<p><strong>Location:</strong> ${escape(session.location)}</p>` : ''}
${session.speakers.length ? `<p><strong>Speakers:</strong> ${session.speakers.map(escape).join(' · ')}</p>` : ''}
${session.category ? `<p><strong>Category:</strong> ${escape(session.category)}</p>` : ''}
${session.description ? `<p class="schedule-description">${description(session.description)}</p>` : '<p>No description was provided in the calendar export.</p>'}
<p><a href="${escape(session.sourceUrl)}">Original session on Sched</a> · <a href="#session-${escape(session.id)}">Link to this archived session</a></p>
</div></details>`).join('\n')}
</section>`).join('\n')}
</section>`;
}

export function replaceScheduleEmbed(document, entry, schedule) {
  // Apply at build time too, so existing captures and future imports use local content.
  const cleaned = document.replace(/<script\b[^>]*id="embed-sched-js"[^>]*>[\s\S]*?<\/script>/g, '')
    .replace(/<p class="schedule-direct">[\s\S]*?<\/p>/g, '');
  return cleaned.replace(/<a\b[^>]*id="sched-embed"[^>]*>[\s\S]*?<\/a>/g,
    () => renderSchedule(schedule, entry.url === '/schedule/'));
}
