"""Regression fixtures for preservation transforms and release-blocking failures."""
import importlib.util
import sys
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from archive_html import adapt
spec = importlib.util.spec_from_file_location('audit', ROOT / 'scripts/check-archive.py')
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)

PAGE = '<html><head><meta name="description" content="Fixture page"></head><body><aside class="archive-notice">Archive</aside><a class="skip-link" href="#main">Skip</a><main id="main"><h1>Fixture</h1>{}</main></body></html>'

class ArchiveTests(unittest.TestCase):
    def test_nested_suppression_preserves_following_content(self):
        output = adapt('<html><body><div class="site__content"><div class="subscribe"><div><form><input></form></div></div><p>Keep &amp; preserve</p><section class="where"><div>Old map</div></section><a href="#">Load more</a></div><footer>Footer</footer></body></html>')
        self.assertIn('<main class="site__content" id="main" tabindex="-1">', output)
        self.assertIn('Keep &amp; preserve', output)
        self.assertIn('</main><footer>Footer</footer>', output)
        self.assertIn('1000 Penn Avenue', output)
        self.assertNotIn('Old map', output)
        self.assertNotIn('<form', output)
        self.assertNotIn('Load more', output)

    def test_decorative_images_and_named_controls(self):
        output = adapt('<body><button class="menu-btn"></button><nav class="header-menu"></nav><img class="background_image" src="hero.jpg"><img src="portrait.jpg" alt="Speaker"><div class="social"><a href="https://twitter.com/clirdlf"><i class="fa fa-twitter"></i></a></div></body>')
        self.assertIn('aria-controls="archive-navigation"', output)
        self.assertIn('aria-label="DLF on Twitter"', output)
        self.assertIn('src="hero.jpg" alt=""', output)
        self.assertIn('alt="Speaker"', output)

    def test_empty_and_incomplete_builds_fail(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp)
            report = checker.audit(site, ['/', '/about/'])
            self.assertTrue(report['emptyBuild'])
            (site / 'index.html').write_text(PAGE.format('Home'))
            report = checker.audit(site, ['/', '/about/'])
            self.assertEqual(report['missingRoutes'], ['/about/'])

    def test_cli_returns_failure_for_empty_build(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'routes.json').write_text('["/"]')
            result = subprocess.run([sys.executable, str(ROOT / 'scripts/check-archive.py'),
                                     '--site', str(root / 'missing-site'),
                                     '--manifest', str(root / 'routes.json'),
                                     '--report', str(root / 'report.json')], capture_output=True)
            self.assertEqual(result.returncode, 1)
            self.assertTrue((root / 'report.json').is_file())

    def test_assets_fragments_and_accessibility(self):
        with tempfile.TemporaryDirectory() as tmp:
            site = Path(tmp)
            (site / 'index.html').write_text(PAGE.format('<link href="style.css"><img src="missing.png"><a href="#absent">Jump</a><a href="#">Dead</a>'))
            (site / 'style.css').write_text('a{background:url(other-missing.png)}')
            report = checker.audit(site, ['/'])
            self.assertEqual(set(report['missingLocalReferences']), {'missing.png', 'other-missing.png'})
            self.assertIn('#absent', report['missingFragments'])
            self.assertIn('Image missing alt', report['accessibilityAndArchiveIssues']['index.html'])
            (site / 'index.html').write_text(PAGE.format('<p id="target">Content</p><a href="#target">Jump</a>'))
            report = checker.audit(site, ['/'])
            self.assertFalse(any(value for key, value in report.items() if key != 'pageCount'))

if __name__ == '__main__':
    unittest.main()
