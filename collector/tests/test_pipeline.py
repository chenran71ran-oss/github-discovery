import json
import tempfile
import unittest
from dataclasses import replace
from datetime import datetime, timedelta
from pathlib import Path

from collector.app import cli, config
from collector.core import settings
from collector.core.settings import PERIODS, TZ
from collector.core.taxonomy import chinese, load
from collector.lab import pipeline

FIXTURE = json.loads((settings.DATA / 'latest.json').read_text())


def offline(**over):
    def down(*a, **k): raise RuntimeError('offline')
    base = dict(trending=down, search=lambda period: [], topics=lambda names, token: {}, readmes=lambda names: {}, upstream=down, translate=down, session=lambda: Dummy())
    return pipeline.Sources(**{**base, **over})


class Dummy:
    def close(self): pass


def cfg(folder, **env):
    return config.from_env({'DISCOVERY_DATA_DIR': str(folder), 'MACHINE_TRANSLATION': '0', **env})


def row(name, gain, origin='trending', stars=None):
    return {'fullName': name, 'periodStars': gain, 'rank': 0, 'origin': origin, 'stars': stars if stars is not None else gain or 0, 'description': 'x', 'language': 'Go'}


class MergeTests(unittest.TestCase):
    opt = pipeline.Options()

    def test_language_pools_add_new_repositories_after_the_main_ranking(self):
        main = [row(f'main/r{i}', 100 - i) for i in range(6)]
        def fake(period, language=''):
            if not language: return [dict(r) for r in main]
            if language == 'go': raise RuntimeError('rate limited')
            return [row('main/r0', 999)] + [row(f'{language}/{i}', (i * 37) % 11) for i in range(settings.POOL_SIZE + 2)]
        rows = pipeline.merge_period('daily', pipeline.Sources(trending=fake, search=lambda p: []), self.opt)
        names = [r['fullName'] for r in rows]
        self.assertEqual(names[:6], [r['fullName'] for r in main])
        self.assertEqual(len(names), len(set(names)))
        self.assertEqual([r['rank'] for r in rows], list(range(1, len(rows) + 1)))
        extra = rows[6:]
        self.assertTrue(all(r['origin'] == 'language' for r in extra))
        self.assertEqual(len(extra), (len(settings.LANGUAGE_POOLS) - 1) * settings.POOL_SIZE)
        gains = [r['periodStars'] for r in extra]
        self.assertEqual(gains, sorted(gains, reverse=True))

    def test_period_merges_trending_language_and_search_without_duplicates(self):
        main = [row('m/a', 50), row('m/b', 40)]
        def fake(period, language=''):
            if not language: return [dict(r) for r in main]
            return [row('m/a', 1), row(f'{language}/x', 5)] if language == 'python' else []
        found = [row('m/b', None, 'search', 9000), row('s/new', None, 'search', 300), row('python/x', None, 'search', 1), row('s/top', None, 'search', 5000)]
        rows = pipeline.merge_period('daily', pipeline.Sources(trending=fake, search=lambda p: found), self.opt)
        self.assertEqual([r['fullName'] for r in rows], ['m/a', 'm/b', 'python/x', 's/top', 's/new'])
        self.assertEqual([r['origin'] for r in rows], ['trending', 'trending', 'language', 'search', 'search'])
        def boom(period): raise RuntimeError('down')
        main[:] = [row(f'm/{i}', 10 - i) for i in range(6)]
        self.assertEqual(len(pipeline.merge_period('daily', pipeline.Sources(trending=fake, search=boom), self.opt)), 6 + 2)
        main[:] = main[:2]
        with self.assertRaises(ValueError): pipeline.merge_period('daily', pipeline.Sources(trending=fake, search=boom), self.opt)

    def test_an_empty_main_page_is_refused_even_with_extras(self):
        src = pipeline.Sources(trending=lambda p, language='': [] if not language else [row('a/b', 1)] * 9, search=lambda p: [row(f's/{i}', None, 'search', 1) for i in range(20)])
        with self.assertRaises(ValueError): pipeline.merge_period('daily', src, self.opt)


class RunTests(unittest.TestCase):
    def test_failed_collection_preserves_previous_complete_rankings(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'latest.json').write_text(json.dumps(FIXTURE))
            cli.run(cfg(folder), offline())
            result = json.loads((Path(folder) / 'latest.json').read_text())
        for period in PERIODS:
            self.assertFalse(result['status'][period]['ok'])
            self.assertEqual(result['status'][period]['capturedAt'], FIXTURE['status'][period]['capturedAt'])
            self.assertEqual([r['fullName'] for r in result['periods'][period]], [r['fullName'] for r in FIXTURE['periods'][period]])

    def test_first_collection_failure_does_not_write_empty_snapshot(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(RuntimeError): cli.run(cfg(folder), offline())
            self.assertFalse((Path(folder) / 'latest.json').exists())

    def test_every_row_is_classified_with_the_current_taxonomy(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'latest.json').write_text(json.dumps(FIXTURE))
            result = cli.run(cfg(folder), offline())
        tax = load()
        self.assertEqual((result['taxonomyVersion'], result['classifier']), (tax.version, 'full'))
        for rows in result['periods'].values():
            for r in rows:
                self.assertIn(r['category'], tax.labels)
                self.assertTrue(set(r['tags']) <= set(tax.labels) - {r['category']})
                self.assertEqual(r['domain'], tax.by_label(r['category']).domain)
                self.assertTrue(r['classification']['reasons'])

    def test_machine_translation_is_cached_labelled_and_never_overrides_real_chinese(self):
        english = next(r for rows in FIXTURE['periods'].values() for r in rows if r['summarySource'] in ('pending', 'machine') and r['description'] != '无描述' and not chinese(r['description']))
        fixture = json.loads(json.dumps(FIXTURE))
        for rows in fixture['periods'].values():  # start without any machine translation
            for r in rows:
                if r['summarySource'] == 'machine': r.update(summary=None, summarySource='pending', summaryAt=None)
        calls = []
        def fake_translate(text, session, email=''):
            calls.append(text); return '机器翻译：' + text[:10]
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / 'latest.json').write_text(json.dumps(fixture))
            c = replace(cfg(folder), translation=True)
            cli.run(c, offline(translate=fake_translate))
            first = len(calls)
            result = cli.run(c, offline(translate=fake_translate))
        self.assertGreater(first, 0)
        self.assertEqual(len(calls), len(set(calls)))  # nothing is translated twice: the cache serves it
        rows = [r for rows in result['periods'].values() for r in rows]
        got = next(r for r in rows if r['fullName'] == english['fullName'])
        self.assertEqual(got['summarySource'], 'machine')
        before = {r['fullName']: r for rows in fixture['periods'].values() for r in rows}
        for r in rows:
            if r['summarySource'] == 'machine': self.assertFalse(chinese(r['description']))
            if before[r['fullName']]['summarySource'] in ('upstream', 'editorial', 'ai-readme'):
                self.assertNotEqual(r['summarySource'], 'machine')


class FeatureCacheTests(unittest.TestCase):
    def test_topics_and_readme_are_cached_and_refreshed(self):
        now = datetime(2026, 11, 2, tzinfo=TZ)
        unique = {'a/notes': row('a/notes', 1), 'b/old': {**row('b/old', 1), 'topics': ['cli']}}
        cache = {'gone/repo': {'seen': '2026-09-01'}}
        asked = {}
        def topics(names, token):
            asked['topics'] = names
            return {'a/notes': ['notes']}
        def readmes(names):
            asked['readme'] = names
            return {n: 'a markdown note-taking app' for n in names}
        src = pipeline.Sources(topics=topics, readmes=readmes)
        pipeline.gather_features(unique, cache, src, pipeline.Options(token='t'), now)
        self.assertNotIn('gone/repo', cache)  # unseen for a month: dropped
        self.assertEqual(asked['topics'], ['a/notes'])  # search rows already carry topics
        self.assertEqual(cache['a/notes']['topics'], ['notes'])
        self.assertIn('productivity', cache['a/notes']['readme']['hits'])
        asked.clear()
        pipeline.gather_features(unique, cache, src, pipeline.Options(token='t'), now + timedelta(days=1))
        self.assertNotIn('readme', asked)  # fresh entries are not fetched again
        self.assertEqual(asked['topics'], [])
        pipeline.gather_features(unique, cache, src, pipeline.Options(token='t'), now + timedelta(days=settings.README_TTL_DAYS + 1))
        self.assertEqual(sorted(asked['readme']), ['a/notes', 'b/old'])


class ConfigTests(unittest.TestCase):
    def test_environment_switches(self):
        c = config.from_env({'GITHUB_TOKEN': 't', 'LLM_BASE_URL': 'https://x', 'LLM_MODEL': 'm', 'LLM_API_KEY': 'k', 'MACHINE_TRANSLATION': '0', 'README_SIGNALS': '0', 'CLASSIFIER_STRATEGY': 'topics'})
        self.assertTrue(c.llm_configured)
        self.assertFalse(c.translation or c.readme)
        self.assertEqual(cli.options(c).strategy.name, 'topics')
        self.assertEqual(cli.options(config.from_env({})).strategy.name, 'full')


if __name__ == '__main__': unittest.main()
