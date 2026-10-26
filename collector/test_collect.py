import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
import collect
from collect import fetch_period, valid_analysis, number, parse_trending_html

class CollectorTests(unittest.TestCase):
    def test_full_membership_not_limited_to_ten(self):
        html = ''.join(f'<article class="Box-row"><h2><a href="/org/repo{i}">repo</a></h2><p>tool</p><a href="/org/repo{i}/stargazers">1,200</a><span>40 stars today</span></article>' for i in range(25))
        self.assertEqual(len(parse_trending_html(html, limit=1000)),25)
    def test_analysis_rejects_english_and_unsupported_category(self):
        value=dict(summary='这是一个文档检索项目。',useCase='用于查找相关资料。',techStack=[],highlights=[],category='开发工具')
        self.assertTrue(valid_analysis(value))
        self.assertFalse(valid_analysis(dict(value, summary='English only')))
        self.assertFalse(valid_analysis(dict(value, category='invented')))
    def test_numbers(self):
        self.assertEqual(number('1.2k'),1200)
        self.assertEqual(number('12,345'),12345)
        self.assertEqual(number('not a number'),0)

    def test_failed_collection_preserves_previous_complete_rankings(self):
        fixture = json.loads((collect.DATA / 'latest.json').read_text())
        with tempfile.TemporaryDirectory() as folder:
            data = Path(folder)
            (data / 'latest.json').write_text(json.dumps(fixture))
            with patch.object(collect, 'DATA', data), patch.object(collect, 'fetch_period', side_effect=RuntimeError('offline')), patch.object(collect, 'create_http_session', side_effect=RuntimeError('offline')), patch.dict(collect.os.environ, {'LLM_API_KEY':'','LLM_BASE_URL':'','LLM_MODEL':''}):
                collect.main()
            result = json.loads((data / 'latest.json').read_text())
            for period in collect.PERIODS:
                self.assertFalse(result['status'][period]['ok'])
                self.assertEqual(result['status'][period]['capturedAt'],fixture['status'][period]['capturedAt'])
                self.assertEqual([r['fullName'] for r in result['periods'][period]], [r['fullName'] for r in fixture['periods'][period]])

    def test_first_collection_failure_does_not_write_empty_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            data = Path(folder)
            with patch.object(collect, 'DATA', data), patch.object(collect, 'fetch_period', side_effect=RuntimeError('offline')), patch.object(collect, 'create_http_session', side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError): collect.main()
            self.assertFalse((data / 'latest.json').exists())

if __name__=='__main__': unittest.main()
