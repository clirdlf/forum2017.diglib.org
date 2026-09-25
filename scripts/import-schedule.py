"""Regenerate the local schedule from committed Sched captures; no network needed."""
from datetime import datetime
from hashlib import sha256
from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]

class Speakers(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.sessions = {}
        self.uid = None
        self.collecting = False
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == 'a' and 'name' in d.get('class', '').split() and d.get('href', '').startswith('event/'):
            self.uid = d['id']
            self.sessions[self.uid] = ''
        if tag == 'span' and 'sched-event-evpeople' in d.get('class', '').split():
            self.collecting = True

    def handle_endtag(self, tag):
        if tag == 'span': self.collecting = False
        if tag == 'a': self.uid = None

    def handle_data(self, value):
        if self.collecting and self.uid:
            self.sessions[self.uid] += value


def text(value):
    return unescape(re.sub(r'\\([nN,;\\])', lambda m: '\n' if m[1].lower() == 'n' else m[1], value))


def parse_calendar(source, speakers):
    events = []
    current = None
    # RFC 5545 line folding: a continuation begins with a space or tab.
    for line in re.sub(r'\r?\n[ \t]', '', source).splitlines():
        if line == 'BEGIN:VEVENT':
            current = {}
        elif line == 'END:VEVENT':
            required = ('UID', 'SUMMARY', 'DTSTART', 'DTEND', 'URL')
            if not current or any(not current.get(k) for k in required):
                raise ValueError('Incomplete calendar event')
            uid = current['UID']
            if not re.fullmatch(r'[a-f0-9]{32}', uid): raise ValueError('Unexpected session UID')
            start, end = [datetime.strptime(current[k], '%Y%m%dT%H%M%SZ').replace(tzinfo=ZoneInfo('UTC')).astimezone(ZoneInfo('America/New_York')) for k in ('DTSTART', 'DTEND')]
            if end <= start or not '2017-10-22' <= start.date().isoformat() <= '2017-10-26':
                raise ValueError('Unexpected session date or duration')
            url = current['URL'].replace('http://', 'https://', 1)
            if url != 'https://dlfforum2017.sched.com/event/' + uid: raise ValueError('Unexpected source URL')
            events.append({'id': uid, 'title': text(current['SUMMARY']), 'start': start.isoformat(),
                           'end': end.isoformat(), 'location': text(current.get('LOCATION', '')),
                           'category': text(current.get('CATEGORIES', '')), 'description': text(current.get('DESCRIPTION', '')),
                           'speakers': [name.strip() for name in speakers.get(uid, '').split('•') if name.strip()], 'sourceUrl': url})
            current = None
        elif current is not None and ':' in line:
            key, value = line.split(':', 1)
            current[key] = value
    if current is not None: raise ValueError('Unclosed calendar event')
    ids = [event['id'] for event in events]
    if not events or len(ids) != len(set(ids)): raise ValueError('Empty or duplicate schedule')
    if set(ids) != set(speakers): raise ValueError('Calendar and public schedule session IDs differ')
    return sorted(events, key=lambda event: (event['start'], event['title']))


def main():
    folder = ROOT / 'data/schedule'
    provenance = json.loads((folder / 'provenance.json').read_text())
    for capture in provenance['captures']:
        if sha256((folder / capture['file']).read_bytes()).hexdigest() != capture['sha256']:
            raise ValueError('Capture checksum mismatch: ' + capture['file'])
    speakers = Speakers((folder / 'schedule.html').read_text()).sessions
    sessions = parse_calendar((folder / 'schedule.ics').read_text(), speakers)
    if len(sessions) != provenance['sessionCount']: raise ValueError('Unexpected session count')
    result = {'sourceUrl': 'https://dlfforum2017.sched.com/', 'capturedAt': provenance['capturedAt'],
              'timezone': 'America/New_York', 'sessions': sessions}
    (ROOT / 'src/_data/schedule.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f'Preserved {len(sessions)} sessions with {sum(bool(s["speakers"]) for s in sessions)} speaker listings')

if __name__ == '__main__': main()
