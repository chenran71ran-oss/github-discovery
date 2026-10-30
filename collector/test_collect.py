import unittest
import json
import tempfile
from pathlib import Path
from unittest.mock import patch
import collect
from collect import fetch_period, valid_analysis, number, parse_trending_html, category, machine_translate, trim_bytes, search_row, search_queries, fetch_search
from datetime import date

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

    def test_categories_use_scores_not_first_match(self):
        self.assertEqual(category('ghidra Ghidra is a software reverse engineering (SRE) framework','Java'),'安全与隐私')
        self.assertEqual(category('opencode The open source coding agent.','TypeScript'),'AI 与智能体')
        self.assertEqual(category('tutor A machine learning course for beginners','Python'),'学习与研究')
        self.assertEqual(category('immich Self-hosted photo and video management solution','TypeScript'),'自托管')
        self.assertEqual(category('app A SwiftUI menu bar app for macOS','Swift'),'移动与桌面')
        self.assertEqual(category('kit Beautiful React components built with Tailwind CSS','TypeScript'),'前端与界面')
        self.assertEqual(category('db A distributed SQL database','Go'),'数据与基础设施')
        self.assertEqual(category('t3code 无描述','未知'),'其他')
        # substrings never count: html is not ml, build is not ui, paid is not ai
        self.assertEqual(category('x Paid build of html pages',''),'前端与界面')
        self.assertEqual(category('x Rotate your user-agent string',''),'其他')

    def test_language_pools_add_new_repositories_after_the_main_ranking(self):
        def row(name, gain): return {'fullName':name,'periodStars':gain,'rank':0,'origin':'trending'}
        main=[row(f'main/r{i}',100-i) for i in range(6)]
        def fake(period, language=''):
            if not language: return [dict(r) for r in main]
            if language=='go': raise RuntimeError('rate limited')
            return [row('main/r0',999)]+[row(f'{language}/{i}',(i*37)%11) for i in range(collect.POOL_SIZE+2)]
        rows=fetch_period('daily', fetch=fake, search=lambda period: [])
        names=[r['fullName'] for r in rows]
        self.assertEqual(names[:6],[r['fullName'] for r in main])
        self.assertEqual(len(names),len(set(names)))
        self.assertEqual([r['rank'] for r in rows],list(range(1,len(rows)+1)))
        extra=rows[6:]
        self.assertTrue(all(r['origin']=='language' for r in extra))
        self.assertEqual(len(extra),(len(collect.LANGUAGE_POOLS)-1)*collect.POOL_SIZE)
        self.assertNotIn(f'python/{collect.POOL_SIZE}',names)  # only the top POOL_SIZE new entries of each pool
        gains=[r['periodStars'] for r in extra]
        self.assertEqual(gains,sorted(gains,reverse=True))

    def test_language_pool_failures_never_hide_a_short_main_ranking(self):
        with self.assertRaises(ValueError):
            fetch_period('daily', fetch=lambda period, language='': [] if not language else [{'fullName':'a/b','periodStars':1}]*9, search=lambda period: [{'fullName':f's/{i}','stars':1} for i in range(20)])

    def test_machine_translation_rejects_quota_notices_and_non_chinese(self):
        class Resp:
            def __init__(self, doc): self.doc=doc
            def raise_for_status(self): pass
            def json(self): return self.doc
        class Session:
            def __init__(self, doc): self.doc=doc; self.params=None
            def get(self, url, params=None, timeout=None): self.params=params; return Resp(self.doc)
        ok=Session({'responseStatus':200,'responseData':{'translatedText':'开源编码智能体 &amp; 工具'}})
        self.assertEqual(machine_translate('The open source coding agent & tool',ok,'me@example.com'),'开源编码智能体 & 工具')
        self.assertEqual(ok.params['langpair'],'en|zh-CN')
        self.assertEqual(ok.params['de'],'me@example.com')
        self.assertIsNone(machine_translate('x',Session({'responseStatus':429,'responseData':{'translatedText':'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS FOR TODAY'}})))
        self.assertIsNone(machine_translate('x',Session({'responseStatus':200,'responseData':{'translatedText':'MYMEMORY WARNING: 用完了'}})))
        self.assertIsNone(machine_translate('x',Session({'responseStatus':200,'responseData':{'translatedText':'still english'}})))
        self.assertLessEqual(len(trim_bytes('é'*600).encode()),480)

    def test_machine_translation_is_cached_labelled_and_never_overrides_real_chinese(self):
        fixture = json.loads((collect.DATA / 'latest.json').read_text())
        english = next(r for rows in fixture['periods'].values() for r in rows if r['summarySource']=='pending' and r['description']!='无描述' and not collect.chinese(r['description']))
        calls=[]
        def fake_translate(text, session, email=''):
            calls.append(text); return '机器翻译：'+text[:10]
        class Dummy:
            def close(self): pass
        with tempfile.TemporaryDirectory() as folder:
            data = Path(folder)
            (data / 'latest.json').write_text(json.dumps(fixture))
            env={'LLM_API_KEY':'','LLM_BASE_URL':'','LLM_MODEL':'','MACHINE_TRANSLATION':'1','MYMEMORY_EMAIL':''}
            with patch.object(collect, 'DATA', data), patch.object(collect, 'fetch_period', side_effect=RuntimeError('offline')), patch.object(collect, 'create_http_session', side_effect=lambda: Dummy()), patch.object(collect, 'machine_translate', side_effect=fake_translate), patch.dict(collect.os.environ, env):
                collect.main()
                first=len(calls)
                collect.main()
            self.assertGreater(first,0)
            self.assertEqual(len(calls),first)  # second run is served from the cache
            result = json.loads((data / 'latest.json').read_text())
            rows=[r for rows in result['periods'].values() for r in rows]
            got=next(r for r in rows if r['fullName']==english['fullName'])
            self.assertEqual(got['summarySource'],'machine')
            self.assertTrue(got['summary'].startswith('机器翻译'))
            for r in rows:
                if r['summarySource']=='machine': self.assertFalse(collect.chinese(r['description']))
            before={r['fullName']:r for rows in fixture['periods'].values() for r in rows}
            for r in rows:
                if before[r['fullName']]['summarySource'] in ('upstream','editorial','ai-readme'):
                    self.assertNotEqual(r['summarySource'],'machine')
                    self.assertTrue(collect.chinese(r['summary']))

    def test_search_rows_are_validated_and_categorised_with_topics(self):
        item={'full_name':'acme/photos','description':'  Your memories,\n your server ','language':None,'stargazers_count':812,'forks_count':12,'topics':['self-hosted','photos'],'created_at':'2026-10-25T00:00:00Z'}
        row=search_row(item)
        self.assertEqual(row['description'],'Your memories, your server')
        self.assertEqual(row['language'],'未知')
        self.assertEqual(row['category'],'自托管')
        self.assertEqual(row['origin'],'search')
        self.assertIsNone(row['periodStars'])
        self.assertEqual(search_row({**item,'description':None})['description'],'无描述')
        for bad in ({**item,'full_name':'not a repo'},{**item,'full_name':'a/b/c'},{**item,'fork':True},{**item,'archived':True}):
            self.assertIsNone(search_row(bad))

    def test_search_queries_depend_on_period_and_token(self):
        today=date(2026,10,30)
        anon=search_queries('daily',today,False)
        self.assertEqual(len(anon),1)
        self.assertIn('created:>=2026-10-23',anon[0][0])
        full=search_queries('monthly',today,True)
        self.assertEqual(len(full),1+len(collect.SEARCH_TOPICS))
        self.assertTrue(all('created:>=2026-08-01' in q for q,_ in full))
        self.assertTrue(any(q.startswith('topic:self-hosted ') for q,_ in full))
        # 1 general + topics per period, three periods, must fit authenticated search's 30 a minute
        self.assertLessEqual(3*len(full)*collect.SEARCH_PAUSE/60*30,3*len(full)*1.2)

    def test_search_failures_are_skipped_and_auth_is_sent(self):
        seen=[]
        class Resp:
            def __init__(self, ok, items): self.ok_=ok; self.items=items
            def raise_for_status(self):
                if not self.ok_: raise RuntimeError('403 rate limited')
            def json(self): return {'items':self.items}
        class Session:
            calls=0
            def get(self, url, params=None, headers=None, timeout=None):
                Session.calls+=1; seen.append((params['q'],headers.get('Authorization')))
                if Session.calls==2: return Resp(False,[])
                return Resp(True,[{'full_name':f'o/r{Session.calls}','description':'x','stargazers_count':Session.calls,'topics':[]}])
            def close(self): pass
        with patch.object(collect,'create_http_session',lambda: Session()), patch.dict(collect.os.environ,{'GITHUB_TOKEN':'t0ken'}):
            rows=fetch_search('weekly',today=date(2026,10,30),pause=0)
        self.assertEqual(len(seen),1+len(collect.SEARCH_TOPICS))
        self.assertTrue(all(a=='Bearer t0ken' for _,a in seen))
        self.assertEqual(len(rows),len(seen)-1)  # the failed query is skipped, the rest still count

    def test_period_merges_trending_language_and_search_without_duplicates(self):
        def row(name, gain, origin='trending'): return {'fullName':name,'periodStars':gain,'rank':0,'origin':origin,'stars':gain or 0}
        main=[row('m/a',50),row('m/b',40)]
        def fake(period, language=''):
            if not language: return [dict(r) for r in main]
            return [row('m/a',1), row(f'{language}/x',5)] if language=='python' else []
        found=[{**row('m/b',None,'search'),'stars':9000},{**row('s/new',None,'search'),'stars':300},{**row('python/x',None,'search'),'stars':1},{**row('s/top',None,'search'),'stars':5000}]
        rows=fetch_period('daily', fetch=fake, search=lambda period: found)
        self.assertEqual([r['fullName'] for r in rows],['m/a','m/b','python/x','s/top','s/new'])
        self.assertEqual([r['origin'] for r in rows],['trending','trending','language','search','search'])
        self.assertEqual([r['rank'] for r in rows],[1,2,3,4,5])
        # a short main page is still published when the other sources fill it out
        rows=fetch_period('daily', fetch=fake, search=lambda period: [{**row(f's/{i}',None,'search'),'stars':i} for i in range(5)])
        self.assertEqual(len(rows),2+1+5)
        # a search outage never blocks a full main ranking
        def boom(period): raise RuntimeError('down')
        main[:]=[row(f'm/{i}',10-i) for i in range(6)]
        self.assertEqual(len(fetch_period('daily', fetch=fake, search=boom)),6+2)  # m/a and python/x come from the python pool
        # but too little in total is still refused
        main[:]=main[:2]
        with self.assertRaises(ValueError): fetch_period('daily', fetch=fake, search=boom)

if __name__=='__main__': unittest.main()
