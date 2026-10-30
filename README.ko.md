<div align="center">

<img src="public/icon.svg" width="96" alt="GIT Bot">

# GIT Bot

**GitHub에서 막 뜨기 시작한 오픈소스 프로젝트를 중국어 설명과 함께 찾아보세요.**

[简体中文](README.md) · [English](README.en.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja-JP.md) · 한국어

[사이트 열기](https://radar.chenran71ran.cc/) · [기능](#기능) · [데이터 출처](#데이터-출처) · [로컬 실행](#로컬-실행) · [시크릿 설정](#시크릿-설정) · [배포](#배포) · [개발 규칙](#개발-규칙)

</div>

## 소개

GIT Bot은 GitHub의 인기 프로젝트와 새로 떠오르는 프로젝트를 매일 모아 일간·주간·월간 순위로 보여 줍니다. 프로젝트마다 중국어 소개, 카테고리, 소개의 출처를 알려 주는 라벨이 붙어 있어 무엇을 하는 프로젝트인지, 써 볼 만한지 빠르게 판단할 수 있습니다.

사이트는 완전한 정적 사이트입니다. GitHub Actions가 매일 데이터를 JSON으로 수집하고, 페이지는 같은 출처의 파일을 바로 읽습니다. 데이터베이스나 백엔드 서비스가 필요 없습니다.

화면은 간체 중국어로 되어 있습니다. [NewsNow](https://github.com/newsnext/newsnow)(MIT)를 기반으로 개발했으며, [GithubTrending](https://github.com/Ibook000/GithubTrending)(Apache-2.0)의 순위 파서를 사용합니다. 자세한 내용은 [UPSTREAM.md](UPSTREAM.md)를 참고하세요.

## 기능

**둘러보기**
- 일간·주간·월간 순위. 과거 날짜의 스냅샷도 고를 수 있습니다.
- 두 가지 레이아웃: 순위순 카드 목록, 또는 용도별 보드.
- 프로젝트마다 둥근 유리 카드 한 장: 아이콘, 순위와 순위 변화, 중국어 소개, 언어, 스타 수, 기간 내 증가한 스타 수.
- '爆发'(급상승) 배지: 기간 내 증가한 스타가 절대 수로도, 전체 대비 비율로도 큰 프로젝트에 붙습니다.

**필터**
- 검색(⌘K / Ctrl K): 이름, 소개, 용도, 기술 스택을 검색합니다.
- 9개 카테고리: AI와 에이전트, 개발 도구, 프런트엔드와 UI, 셀프 호스팅, 데이터와 인프라, 보안과 개인정보, 모바일과 데스크톱, 학습과 연구, 기타.
- 프로그래밍 언어로 필터링하고, 순위·전체 스타·기간 내 증가 수로 정렬할 수 있습니다.
- 기간·검색어·언어·카테고리·날짜가 URL에 남아 링크로 그대로 공유할 수 있습니다.

**디자인과 모바일**
- 리퀴드 글래스 스타일과 10가지 색상 테마(다크 6, 라이트 4). 시스템의 라이트/다크 설정을 따를 수도 있습니다.
- iPhone에 맞춘 구성: 떠 있는 하단 바, 아래에서 올라오는 시트, 안전 영역 대응. 홈 화면에 추가해 앱처럼 쓸 수 있습니다.
- 시스템의 '동작 줄이기', '투명도 줄이기' 설정을 따릅니다.

**즐겨찾기**
- 지금 쓰는 브라우저에 저장됩니다. 계정이 필요 없고, GitHub 스타와 동기화되지 않습니다.

## 데이터 출처

수집 스크립트 `collector/collect.py`는 매일 한국 시간 09:20에 실행됩니다. 기간마다 세 가지 출처에서 데이터를 가져와 중복 저장소를 제거한 뒤 아래 순서로 나열합니다.

| 출처 | 내용 | 페이지 라벨 |
| :--- | :--- | :--- |
| GitHub Trending(전체 언어) | Trending 전체 목록. 원래 순위와 기간 내 증가한 스타 수를 그대로 씁니다 | — |
| 언어별 페이지 | 12개 언어(Python, TypeScript, JavaScript, Go, Rust, Java, C++, C, C#, Swift, Kotlin, PHP) 각각의 Trending에서, 전체 목록에 없는 프로젝트를 언어당 최대 5개 | 语言榜(언어별) |
| GitHub 검색 | 최근에 만들어졌고 스타가 빠르게 늘고 있는 프로젝트. 일간은 최근 7일, 주간은 30일, 월간은 90일 안에 만들어진 것. 전체 상위 30개에 8개 주제별로 최대 8개씩 더합니다 | 新项目(신규) |

GitHub Trending은 이제 한 페이지에 8~20개 정도만 보여 주기 때문에, 나머지 두 출처가 대부분을 채웁니다. 2026-10-30의 한 번의 수집에서는 일간 141개, 주간 150개, 월간 166개, 중복을 빼면 385개 프로젝트였습니다.

카테고리는 프로젝트 이름, 설명, GitHub 주제 태그의 키워드에 점수를 매겨 정합니다. AI 해설을 설정했다면 검증을 통과한 AI 결과가 우선합니다.

출처 하나가 실패하면 그 출처만 건너뜁니다. 어떤 기간의 전체 언어 목록을 가져오지 못하면 그 기간의 직전 완전한 순위를 유지하고, 수집 시각을 페이지에 표시합니다. 첫 수집부터 실패하면 빈 사이트를 배포하지 않고 오류로 멈춥니다.

### 중국어 소개

각 프로젝트의 소개는 아래 순서에서 처음 쓸 수 있는 것을 사용하며, 페이지에 항상 출처를 표시합니다.

| 순서 | 출처 | 페이지 라벨 |
| :--- | :--- | :--- |
| 1 | README를 읽은 AI가 생성하고 형식 검증을 통과한 내용(`LLM_*` 설정 필요) | README 解读(README 해설) |
| 2 | GithubTrending이 공개한 중국어 요약(7일 이내) | 中文速览(중국어 요약) |
| 3 | 각 프로젝트의 공개 설명으로 만든 초기 자료(`collector/editorial.json`). 설명이 바뀌면 더 이상 쓰지 않습니다 | 资料速览(자료 요약) |
| 4 | MyMemory 무료 API로 프로젝트 자체 설명을 기계 번역한 내용 | 机器翻译(기계 번역) |
| 5 | 아무것도 없으면 원래 설명을 표시 | 解读待补充(준비 중) |

기계 번역은 설명의 해시를 키로 `public/data/translation-cache.json`에 캐시되어, 같은 설명은 한 번만 번역합니다. 1~3번 내용을 덮어쓰지도 않습니다. 템플릿 문장을 AI 분석인 것처럼 보여 주지 않습니다.

## 로컬 실행

Node.js 24와 pnpm 10.30.3이 필요합니다. 수집을 실행하려면 Python 3.12도 필요합니다.

```bash
corepack pnpm install --frozen-lockfile
pnpm dev                 # 정적 데이터 모드: public/data/의 JSON을 읽습니다
```

수집된 데이터가 저장소에 이미 들어 있어서, 프런트엔드를 여는 데는 데이터베이스나 시크릿이 필요 없습니다.

```bash
pnpm build:preview       # 정적 빌드, 결과물은 dist/
pnpm typecheck           # 타입 검사(자동 import 선언을 만들기 위해 먼저 한 번 빌드해야 합니다)
pnpm exec vitest run shared/discovery.test.ts
```

수집 실행:

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r collector/requirements.txt
export GITHUB_TOKEN=개인_토큰   # 선택 사항. 없으면 검색은 기간마다 전체 쿼리를 한 번만 실행합니다
python collector/collect.py
python -m unittest discover -s collector -p 'test_*.py'
```

> 로컬에서 수집하면 `public/data/`가 바뀝니다. 이 폴더는 매일 도는 수집 봇만 커밋하므로, 테스트가 끝나면 `git restore public/data && git clean -fd public/data`로 되돌려 주세요.

## 시크릿 설정

수집은 GitHub Actions에서 실행되므로, 시크릿은 Cloudflare가 아니라 **GitHub 저장소**의 Settings → Secrets and variables → Actions에 추가합니다. 모두 선택 사항입니다.

| 이름 | 용도 |
| :--- | :--- |
| `LLM_BASE_URL` | OpenAI Chat Completions 호환 API의 HTTPS 주소 |
| `LLM_MODEL` | 모델 식별자 |
| `LLM_API_KEY` | 해당 서비스의 API 키 |
| `MYMEMORY_EMAIL` | 기계 번역용 연락 이메일. 하루 무료 한도가 5,000자에서 50,000자로 늘어납니다 |

`LLM_*` 세 가지를 모두 설정하면 각 README를 읽어 중국어 소개, 사용 사례, 기술 스택, 주요 특징, 카테고리를 생성합니다. 요청이나 검증이 실패하면 기존 내용을 유지합니다. 시크릿은 프런트엔드나 데이터 파일에 기록되지 않습니다.

검색에 쓰는 `GITHUB_TOKEN`은 GitHub Actions가 자동으로 제공하므로 따로 추가할 필요가 없습니다.

## 배포

운영 환경은 Cloudflare Pages에 있습니다. 프로젝트 이름은 `github-discovery`, 운영 브랜치는 `main`입니다.

| 설정 | 값 |
| :--- | :--- |
| 빌드 명령 | `npx --yes pnpm@10.30.3 install --frozen-lockfile && npm run build:preview` |
| 출력 디렉터리 | `dist` |
| Node 버전 | `24` |
| 데이터베이스 / 환경 변수 | 필요 없음 |

수집 봇이 새 데이터를 `main`에 커밋하면 Cloudflare가 사이트를 다시 빌드합니다. 페이지의 새로고침 버튼은 배포된 데이터를 다시 읽기만 하고, 수집을 시작하지 않습니다.

NewsNow의 Nitro 백엔드(`server/`)는 남겨 두었습니다. 필요하면 `CF_PAGES=1 npm run build`로 전체 버전을 빌드할 수 있으며, 설정 방법은 [NewsNow README](docs/NEWSNOW-README.md)를 참고하세요. 운영 환경에서는 쓰지 않습니다.

## 디렉터리 구성

| 경로 | 내용 |
| :--- | :--- |
| `src/components/discovery/` | 첫 페이지: 카드, 필터, 색상 테마, 상세, 스타일 |
| `shared/discovery.ts` | 페이지와 수집기가 함께 쓰는 데이터 형식, 필터, 검증 |
| `collector/` | 수집, 카테고리 분류, 중국어 소개, 테스트, 업스트림 파서 |
| `public/data/` | 최신 순위, 과거 스냅샷, AI·번역 캐시 |
| `.github/workflows/` | 매일 수집과 CI 검사 |
| `server/` | 남겨 둔 NewsNow Nitro 백엔드 |

## 개발 규칙

- `main`이 운영 기준입니다. 기능은 `feat/<모듈>`, 수정은 `fix/<문제>`, 유지보수는 `chore/<작업>` 브랜치에서 하고, PR과 CI를 통과한 뒤 병합합니다. 자세한 내용은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.
- CI(Discovery checks)는 전체 빌드, 타입 검사, 데이터 형식 테스트, 수집기 테스트, 정적 빌드를 차례로 실행하고 `discovery-static-preview` 미리보기를 업로드합니다.
- 데이터 형식은 `shared/discovery.ts`에 모여 있습니다. 필드를 바꿀 때는 수집 출력, 검증, 프런트엔드, 테스트를 함께 고쳐야 합니다.
- `public/data/**`를 `main`에 직접 커밋할 수 있는 것은 수집 봇뿐입니다.

**롤백**: 개편 전 소스는 [`backup/radar-before-newsnow-20261026`](https://github.com/chenran71ran-oss/github-discovery/tree/backup/radar-before-newsnow-20261026) 브랜치에 남아 있습니다. 되돌려야 할 때는 먼저 Cloudflare Pages 배포 목록에서 이전 배포에 Rollback을 실행하세요. 데이터베이스나 도메인을 바꿀 필요는 없습니다.

## 출처와 라이선스

- [NewsNow](https://github.com/newsnext/newsnow): MIT, 라이선스 전문은 [LICENSE](LICENSE).
- [GithubTrending](https://github.com/Ibook000/GithubTrending): Apache-2.0, 라이선스 전문은 [collector/vendor/LICENSE](collector/vendor/LICENSE). 파서는 수정하지 않고 사용합니다.
- 변경 내용은 [UPSTREAM.md](UPSTREAM.md)에 정리되어 있습니다. 이 프로젝트는 업스트림 소스를 가져와 발전시킨 것으로, GitHub의 정식 포크가 아니며 업스트림 프로젝트의 승인을 받은 것도 아닙니다.
- 프로젝트 아이콘은 각 저장소 소유자의 GitHub 아바타이고, 순위 데이터는 GitHub에서 가져옵니다.
