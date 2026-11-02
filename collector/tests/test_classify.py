import json
import unittest

from collector.blocks.classify import signals
from collector.blocks.classify.engine import Evidence, classify
from collector.core.settings import TAXONOMY_FILE
from collector.core.taxonomy import load, word_pattern
from collector.lab import evaluate, strategies


def label(name, desc, lang='', topics=(), strategy='full', readme=None):
    tax = load()
    return classify(Evidence(name, desc, lang, topics=tuple(topics), readme=signals.readme_features(tax, readme) if readme else None), strategies.get(strategy))


class TaxonomyTests(unittest.TestCase):
    def test_taxonomy_is_consistent(self):
        tax = load()
        doc = json.loads(TAXONOMY_FILE.read_text())
        ids = [c.id for c in tax.categories]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(len(tax.labels), len(set(tax.labels)))
        self.assertGreaterEqual(len(tax.categories), 20)
        self.assertTrue(all(c.domain in tax.domains for c in tax.categories))
        self.assertTrue({'tools', 'life'} <= {c.domain for c in tax.categories})
        self.assertTrue(all(c.facet in doc['facets'] for c in tax.categories))
        self.assertTrue(all(v in ids for v in tax.language_hints.values()))
        self.assertTrue(all(v in ids for v in tax.legacy.values()))
        self.assertTrue(all(c.stream_topics and set(c.stream_topics) <= c.topics for c in tax.categories))

    def test_words_need_boundaries_and_match_plurals(self):
        p = word_pattern(['ml', 'ui', 'ai', 'coding agent'])
        self.assertIsNone(p.search('html build paid'))
        self.assertTrue(p.search('tools for coding agents'))
        self.assertTrue(p.search('an ai tool'))


class EngineTests(unittest.TestCase):
    def test_purpose_beats_implementation(self):
        self.assertEqual(label('x/ai-notes', 'AI-powered note-taking app with markdown')['category'], '效率与办公')
        self.assertEqual(label('x/vpn', 'Multi-engine Android VPN with WireGuard and Tor', 'Kotlin', ['android'])['category'], '安全与隐私')
        out = label('x/fit', 'Workout tracker app for iOS', 'Swift', ['ios', 'fitness'])
        self.assertEqual(out['category'], '健康与运动')
        self.assertIn('移动与桌面', out['tags'])
        self.assertEqual(out['domain'], 'life')

    def test_tools_and_life_categories(self):
        cases = [
            ('yt-dlp/yt-dlp', 'A feature-rich command-line audio/video downloader', 'Python', [], '音视频与图像'),
            ('home-assistant/core', 'Open source home automation that puts local control and privacy first', 'Python', ['home-assistant', 'iot'], '智能家居与硬件'),
            ('x/budget', 'Personal finance and budgeting app', 'TypeScript', [], '理财与金融'),
            ('x/emu', 'Nintendo Switch emulator written in C++', 'C++', [], '游戏'),
            ('x/recipes', 'Self-hosted recipe manager and meal planner', 'Python', ['recipes', 'cooking'], '出行与生活'),
            ('x/ghidra', 'Ghidra is a software reverse engineering (SRE) framework', 'Java', [], '安全与隐私'),
            ('x/course', 'LeetCode solutions and interview guide for beginners', 'Python', [], '教程与资源'),
        ]
        for name, desc, lang, topics, want in cases:
            with self.subTest(name=name): self.assertEqual(label(name, desc, lang, topics)['category'], want)

    def test_two_honest_answers_are_both_shown(self):
        # a self-hosted photo manager is a media tool and a self-hosted app: one primary, one tag
        out = label('immich-app/immich', 'Self-hosted photo and video management solution', 'TypeScript', ['self-hosted'])
        self.assertEqual({out['category'], *out['tags']} & {'自托管', '音视频与图像'}, {'自托管', '音视频与图像'})

    def test_no_evidence_is_other_with_an_explanation(self):
        out = label('x/t3code', '')
        self.assertEqual((out['category'], out['tags'], out['classification']['confidence']), ('其他', [], 0.0))
        self.assertTrue(out['classification']['reasons'])

    def test_evidence_purposes_and_stack_are_reported(self):
        out = label('x/notes', 'Markdown note-taking app built with Tauri and React', 'Rust', ['notes'])
        self.assertTrue(any(r.startswith(('关键词', '主题')) for r in out['classification']['reasons']))
        self.assertIn('笔记', out['purposes'])
        self.assertTrue({'Tauri', 'React'} <= set(out['techStack']))
        self.assertGreater(out['classification']['confidence'], 0)
        self.assertLessEqual(out['classification']['confidence'], 1)

    def test_readme_is_weaker_than_the_description(self):
        out = label('x/kit', 'Beautiful React components built with Tailwind CSS', 'TypeScript', readme='this project uses a postgres database and kubernetes for the demo')
        self.assertEqual(out['category'], '前端与界面')

    def test_validated_model_category_is_trusted(self):
        tax = load()
        out = classify(Evidence('x/y', 'An agent framework', 'Python', model_label='理财与金融'), strategies.get('full'), tax)
        self.assertEqual((out['category'], out['classification']['by']), ('理财与金融', 'ai'))


class EvaluationTests(unittest.TestCase):
    """Guards against classifier regressions on hand-labelled repositories (offline, no README)."""
    def test_production_strategy_beats_keyword_baseline(self):
        for path in (evaluate.GOLD, evaluate.HOLDOUT):
            gold = evaluate.load_gold(path)
            full = evaluate.score(strategies.get('full'), gold)
            base = evaluate.score(strategies.STRATEGIES['keywords'], gold)
            with self.subTest(set=path.name):
                self.assertGreaterEqual(full['topTags'], base['topTags'])
                self.assertGreaterEqual(full['accuracy'], 0.45)

    def test_gold_labels_exist(self):
        ids = {c.id for c in load().categories}
        for path in (evaluate.GOLD, evaluate.HOLDOUT):
            self.assertTrue(all(g['label'] in ids for g in evaluate.load_gold(path)))


if __name__ == '__main__': unittest.main()
