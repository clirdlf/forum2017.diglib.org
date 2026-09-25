import importlib.util
import unittest
import json
from hashlib import sha256
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('schedule_import', ROOT / 'scripts/import-schedule.py')
schedule = importlib.util.module_from_spec(spec)
spec.loader.exec_module(schedule)
UID = 'a' * 32
FIXTURE = f'''BEGIN:VCALENDAR
BEGIN:VEVENT
UID:{UID}
DTSTART:20171022T120000Z
DTEND:20171022T133000Z
SUMMARY:Folded\n title\\, continued
DESCRIPTION:First\\nSecond &amp; third
URL:http://dlfforum2017.sched.com/event/{UID}
END:VEVENT
END:VCALENDAR
'''

class ScheduleTests(unittest.TestCase):
    def test_committed_captures_reproduce_generated_sessions(self):
        folder = ROOT / 'data/schedule'
        provenance = json.loads((folder / 'provenance.json').read_text())
        for capture in provenance['captures']:
            self.assertEqual(sha256((folder / capture['file']).read_bytes()).hexdigest(), capture['sha256'])
        speakers = schedule.Speakers((folder / 'schedule.html').read_text()).sessions
        sessions = schedule.parse_calendar((folder / 'schedule.ics').read_text(), speakers)
        generated = json.loads((ROOT / 'src/_data/schedule.json').read_text())
        self.assertEqual(sessions, generated['sessions'])
        self.assertEqual(len(sessions), provenance['sessionCount'])

    def test_folded_lines_escapes_timezone_and_speakers(self):
        event = schedule.parse_calendar(FIXTURE, {UID: 'One • Two'})[0]
        self.assertEqual(event['title'], 'Foldedtitle, continued')
        self.assertEqual(event['description'], 'First\nSecond & third')
        self.assertEqual(event['start'], '2017-10-22T08:00:00-04:00')
        self.assertEqual(event['speakers'], ['One', 'Two'])

    def test_partial_capture_and_invalid_dates_are_rejected(self):
        with self.assertRaises(ValueError): schedule.parse_calendar(FIXTURE, {})
        with self.assertRaises(ValueError): schedule.parse_calendar(FIXTURE.replace('20171022T133000Z', '20171022T110000Z'), {UID: ''})
        with self.assertRaises(ValueError): schedule.parse_calendar(FIXTURE.replace('END:VEVENT', ''), {UID: ''})
