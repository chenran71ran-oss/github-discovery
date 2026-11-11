import unittest
from datetime import date
from unittest.mock import patch

from collector.blocks import search, translate
from collector.blocks.http import number, parse_trending_html
from collector.blocks.llm import valid_analysis
from collector.core import settings
from collector.core.taxonomy import load


class FetcherTests(unittest.TestCase):
    def test_full_membership_not_limited_to_ten(self):
        html = ''.join(f'<article class="Box-row"><h2><a href="/org/repo{i}">repo</a></h2><p>tool</p><a href="/org/repo{i}/stargazers">1,200</a><span>40 stars today</span></article>' for i in range(25))
        self.assertEqual(len(parse_trending_html(html, limit=1000)), 25)

    def test_numbers(self):
        self.assertEqual(number('1.2k'), 1200)
        self.assertEqual(number('12,345'), 12345)
        self.assertEqual(number('not a number'), 0)

    def test_search_rows_are_validated_and_keep_topics(self):
        item = {'full_name': 'acme/photos', 'description': '  Your memories,\n your server ', 'language': None, 'stargazers_count': 812, 'forks_count': 12, 'topics': ['self-hosted', 'photos'], 'created_at': '2026-10-25T00:00:00Z'}
        row = search.search_row(item, 'topic:self-hosted')
        self.assertEqual(row['description'], 'Your memories, your server')
        self.assertEqual(row['language'], '未知')
        self.assertEqual(row['topics'], ['self-hosted', 'photos'])
        self.assertEqual((row['origin'], row['stream']), ('search', 'topic:self-hosted'))
        self.assertIsNone(row['periodStars'])
        self.assertEqual(search.search_row({**item, 'description': None})['description'], '无描述')
        for bad in ({**item, 'full_name': 'not a repo'}, {**item, 'full_name': 'a/b/c'}, {**item, 'fork': True}, {**item, 'archived': True}):
            self.assertIsNone(search.search_row(bad))

    def test_search_streams_cover_every_category_when_authenticated(self):
        today = date(2026, 10, 30)
        anon = search.search_queries('daily', today, False)
        self.assertEqual([s for _, _, s in anon], ['general'])
        self.assertIn('created:>=2026-10-23', anon[0][0])
        full = search.search_queries('monthly', today, True)
        streams = {s for _, _, s in full}
        self.assertEqual(streams - {'general'}, {f'topic:{t}' for c in load().categories for t in c.stream_topics})
        self.assertTrue(any(q.startswith('topic:self-hosted ') and 'created:>=2026-07-02' in q for q, _, _ in full))
        # three periods of queries at 30 requests a minute must finish within a few minutes
        self.assertGreaterEqual(settings.SEARCH_PAUSE, 2.0)
        self.assertLessEqual(3 * len(full) * settings.SEARCH_PAUSE / 60, 4)

    def test_search_failures_are_skipped_and_auth_is_sent(self):
        seen = []
        class Resp:
            def __init__(self, ok, items): self.ok_, self.items = ok, items
            def raise_for_status(self):
                if not self.ok_: raise RuntimeError('403 rate limited')
            def json(self): return {'items': self.items}
        class Session:
            calls = 0
            def get(self, url, params=None, headers=None, timeout=None):
                Session.calls += 1; seen.append((params['q'], headers.get('Authorization')))
                if Session.calls == 2: return Resp(False, [])
                return Resp(True, [{'full_name': f'o/r{Session.calls}', 'description': 'x', 'stargazers_count': Session.calls, 'topics': []}])
            def close(self): pass
        with patch.object(search, 'create_http_session', lambda: Session()):
            rows = search.fetch_search('weekly', date(2026, 10, 30), token='t0ken', pause=0)
        self.assertEqual(len(seen), len(search.search_queries('weekly', date(2026, 10, 30), True)))
        self.assertTrue(all(a == 'Bearer t0ken' for _, a in seen))
        self.assertEqual(len(rows), len(seen) - 1)  # the failed query is skipped, the rest still count


class TextTests(unittest.TestCase):
    def test_analysis_rejects_english_and_unsupported_category(self):
        value = dict(summary='这是一个文档检索项目。', useCase='用于查找相关资料。', techStack=[], highlights=[], category='开发工具')
        self.assertTrue(valid_analysis(value))
        self.assertTrue(valid_analysis(dict(value, category='理财与金融')))  # new taxonomy labels are accepted
        self.assertFalse(valid_analysis(dict(value, summary='English only')))
        self.assertFalse(valid_analysis(dict(value, category='invented')))

    def test_machine_translation_rejects_quota_notices_and_non_chinese(self):
        class Resp:
            def __init__(self, doc): self.doc = doc
            def raise_for_status(self): pass
            def json(self): return self.doc
        class Session:
            def __init__(self, doc): self.doc, self.params = doc, None
            def get(self, url, params=None, timeout=None): self.params = params; return Resp(self.doc)
        ok = Session({'responseStatus': 200, 'responseData': {'translatedText': '开源编码智能体 &amp; 工具'}})
        self.assertEqual(translate.machine_translate('The open source coding agent & tool', ok, 'me@example.com'), '开源编码智能体 & 工具')
        self.assertEqual((ok.params['langpair'], ok.params['de']), ('en|zh-CN', 'me@example.com'))
        for doc in ({'responseStatus': 429, 'responseData': {'translatedText': 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY'}}, {'responseStatus': 200, 'responseData': {'translatedText': 'MYMEMORY WARNING: 用完了'}}, {'responseStatus': 200, 'responseData': {'translatedText': 'still english'}}):
            self.assertIsNone(translate.machine_translate('x', Session(doc)))
        self.assertLessEqual(len(translate.trim_bytes('é' * 600).encode()), 480)


if __name__ == '__main__': unittest.main()


class HistoryTests(unittest.TestCase):
    def snap(self, **stars):
        return {"periods": {"daily": [{"fullName": k.replace("__", "/"), "stars": v} for k, v in stars.items()]}}

    def test_pick_past_prefers_exact_window_then_oldest_inside(self):
        from collector.blocks.history import pick_past
        today = date(2026, 11, 11)
        days = ["2026-10-01", "2026-10-26", "2026-11-04", "2026-11-10"]
        self.assertEqual(pick_past(today, "daily", days), ("2026-11-10", 1))
        self.assertEqual(pick_past(today, "weekly", days), ("2026-11-04", 7))
        self.assertEqual(pick_past(today, "monthly", days), ("2026-10-26", 16))
        self.assertIsNone(pick_past(today, "daily", ["2026-11-08"]))

    def test_star_deltas_for_every_row_found_earlier(self):
        from collector.blocks.history import add_star_deltas, stars_by_repo
        periods = {"daily": [{"fullName": "a/one", "stars": 150, "starDelta": 1}, {"fullName": "b/two", "stars": 10, "starDelta": 3}]}
        add_star_deltas(periods, {"2026-11-10": stars_by_repo(self.snap(a__one=100))}, {"daily": ("2026-11-10", 1)})
        self.assertEqual((periods["daily"][0]["starDelta"], periods["daily"][0]["starDeltaDays"]), (50, 1))
        self.assertNotIn("starDelta", periods["daily"][1])

    def test_first_seen_keeps_earliest_day(self):
        from collector.blocks.history import build_first_seen, update_first_seen
        index = build_first_seen({"2026-11-02": self.snap(a__one=1), "2026-11-01": self.snap(a__one=1, b__two=1)})
        self.assertEqual(index, {"a/one": "2026-11-01", "b/two": "2026-11-01"})
        periods = {"daily": [{"fullName": "a/one"}, {"fullName": "c/three"}]}
        update_first_seen(index, periods, "2026-11-11")
        self.assertEqual([r["firstSeen"] for r in periods["daily"]], ["2026-11-01", "2026-11-11"])
