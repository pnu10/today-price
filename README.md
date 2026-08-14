# 오늘만 이 가격 — 토스쇼핑 특가·랭킹 미니앱

토스쇼핑 쉐어링크 Open API의 **하루특가 · 베스트 · 판매순위**를 랭킹 보드로 보여주고,
발급받은 쉐어링크를 통한 구매를 제휴 수익으로 정산받는 앱인토스 미니앱.

- **사용자에게 보이는 이름**: `오늘만 이 가격` — 앱인토스 **콘솔에서** 관리한다(코드 아님)
- **배포 식별자**: `today-price` — `apps-in-toss.config.ts`의 `appName`, 콘솔 등록값과 일치해야 한다

`lowest-pick`(최저가픽)과 **같은 API·같은 인증 정보**를 쓰지만 별개의 앱이라
앱인토스 콘솔에 새로 등록해야 배포된다.

## 화면 4개

| 탭 | 출처 |
| --- | --- |
| ⏰ 하루특가 | `GET /products/today-deals` — 그날만 파는 특가. 편성이 없는 날은 0건일 수 있다 |
| 🏆 베스트 | `GET /products/best-selling` — 전체 판매 순위 |
| 🚀 인기급상승 | **API에 없다.** 아래 참고 |
| 📊 판매순위 | `GET /products/best-categories/{id}` — 1차 카테고리 16개별 판매 순위 |

테마는 라이트 모드다. 색은 `index.html` 맨 위 `:root` 토큰에 모여 있다.
**`--lime`(#DDFF55)은 칠하는 색이지 글자색이 아니다** — 흰 배경 위에서는 보이지 않으므로
글자·그래프 선에는 반드시 `--limeInk`를 쓴다.

## 인기급상승은 직접 만든다

쉐어링크 Open API에는 인기급상승 엔드포인트가 없다(어드민 "베스트 링크" 화면에만 있는 탭이다).
그래서 동기화할 때마다 `best-selling`의 `rank`를 `rank-history.json`에 스냅샷으로 쌓고,
**5시간 이상 벌어진 가장 최근 스냅샷**과 비교해 순위 상승폭을 계산한다.

- `rankDelta > 0` → ▲N (순위 상승)
- 이전 스냅샷에 없던 상품 → `isNew` → NEW 배지
- 비교 기준 시각은 `catalog.json`의 `deltaBaseAt`에 담기고, 앱이 "N일 전 대비"로 표시한다

`rank-history.json`은 `lowest-pick`의 git 히스토리에 남아 있던 실제 랭킹 스냅샷
(2026-08-06 / 08-07 / 08-11)으로 씨앗을 넣어둬서, 첫날부터 값이 나온다.

## ⚠️ 일일 쿼터 — `/categories`를 매번 부르면 안 된다

쿼터는 **"응답으로 받은 상품 수 10,000개/일"**(KST 자정 리셋)로 계산된다.
`/categories`는 전체 카테고리 트리 **10,582개 노드**를 한 번에 내려주므로,
이 호출 하나로 하루치가 통째로 날아간다.

그래서 `sync.py`는 1차 카테고리 목록을 `category-tree.json`에 캐시하고 **7일에 한 번만** 갱신한다.
강제로 갱신하려면 `--refresh-categories` (그날 다른 동기화는 포기할 각오로).

한도를 넘기면 HTTP 200에 `SHARELINK_OPENAPI_QUOTA_EXCEEDED`가 온다. 재시도해도 같으니 다음 날까지 기다린다.

## 동기화

```bash
python3 sync.py
```

토큰 발급 → `/health` → 하루특가·베스트·카테고리 조회 → 급상승 계산 → 쉐어링크 발급 → `catalog.json` 저장.
표준 라이브러리만 쓴다(이 맥에 node가 없어서 파이썬으로 짰다).

| 플래그 | 설명 |
| --- | --- |
| `--no-categories` | 카테고리 생략(빠르고 쿼터도 아낀다) |
| `--per-category N` | 카테고리당 개수 (기본 20) |
| `--best-size N` | 베스트 개수 (기본 100) |
| `--min-dc 20` | 할인율 20% 이상만 (기본 0 — 베스트엔 정가 상품도 많다) |
| `--no-link` | 쉐어링크 발급 생략, 캐시된 링크만 사용 |
| `--refresh-categories` | 카테고리 트리 강제 갱신 (쿼터 주의) |
| `--dry` | 저장하지 않고 결과만 출력 |
| `--alpha` | 알파(테스트) 환경 |

### 링크는 반드시 발급받은 것만

조회 API가 주는 `productUrl`은 **추적이 안 되는** 일반 링크라 그 링크로 발생한 구매는 수익이 되지 않는다.
`sync.py`는 `productUrl`을 저장조차 하지 않고, `POST /links`로 받은 `shortUrl`만 `url`에 담는다.
발급이 거절된 상품(셀러 정책 등)은 카탈로그에서 빠진다.

발급받은 링크는 `links.json`에 캐시된다. 같은 `tacaItemId` + 같은 `publisherId`면 같은 링크가 나오므로
매번 발급하면 쿼터만 낭비한다. (`lowest-pick`의 캐시 346건을 씨앗으로 복사해뒀다.)

### 하루특가는 마감 전에 다시 돌리기

하루특가는 보통 그날 자정에 다 같이 끝난다(`endAt`이 전부 같다). 끝난 특가를 계속 노출하지 않도록
동기화 로그의 "가장 빨리 끝나는 특가" 시각 전에 다시 실행한다.
앱도 클라이언트에서 `endAt`이 지난 상품은 화면에서 걸러낸다.

## 실행

```bash
python3 -m http.server 4336 --directory .
```

`catalog.json`·`price-history.json`을 같은 폴더에서 읽는다.
배포 후 재빌드 없이 데이터만 갈아끼우려면 `index.html`의 `REMOTE` 상수에 호스팅 URL을 넣는다.

## 앱인토스 배포

⚠️ **이 맥에 node가 설치돼 있지 않다.** `ait`가 node로 돌아가므로 배포 전에 먼저:

```bash
brew install node && npm install
```

그다음:

```bash
npm run build   # vite build → catalog.json 복사 → ait build
npm run deploy
```

`apps-in-toss.config.ts`의 `appName`(`today-price`)이 콘솔에 등록한 앱 식별자와 같아야 한다.

## 임시 데이터

`bootstrap-from-lowest-pick.py`는 API 쿼터가 소진된 날 UI를 검증하려고 만든 1회용 스크립트다.
데이터는 실제 토스 응답이지만 **카테고리는 lowest-pick의 키워드 휴리스틱이라 정확하지 않다.**
그래서 이때 만든 `catalog.json`에는 `bootstrap: true`가 들어가고, 앱 상단에 "임시 데이터"라고 표시된다.

`python3 sync.py`를 한 번 돌리면 통째로 대체되고 진짜 카테고리가 들어간다. 그 뒤엔 이 스크립트를 지워도 된다.

## 자동 동기화 (launchd)

`com.todayprice.sync` — **매일 16:20 로컬**(= KST 00:20)에 `sync.py`를 한 번 돌린다.
하루특가 편성과 API 쿼터 리셋이 둘 다 KST 자정에 일어나서, 그 직후가 가장 좋은 타이밍이다.

```bash
launchctl print gui/$UID/com.todayprice.sync | grep -E 'state|runs|last exit'
launchctl kickstart -p gui/$UID/com.todayprice.sync   # 즉시 실행
tail -20 ~/apps/today-price/sync.log
```

끄려면 `launchctl bootout gui/$UID/com.todayprice.sync`.

**⚠️ 이 프로젝트가 `~/Downloads`에 있으면 안 된다.** macOS TCC가 백그라운드 launchd 작업의
`~/Downloads`·`~/Desktop`·`~/Documents` 접근을 막아서, 스크립트를 읽지도 못하고
`Operation not permitted`로 죽는다(터미널에서 직접 돌릴 땐 잘 된다). 그래서 `~/apps`에 둔다.

**⚠️ 하루 한 번인 이유 — 실측 쿼터.** 2026-08-13에 풀 동기화 한 번(상품 502개)으로
일일 쿼터가 소진됐다. 문서의 "10,000개"와 다르니 두 번째 실행을 걸어도 QUOTA_EXCEEDED로 죽는다.
실패해도 기존 `catalog.json`은 보존되므로 앱이 깨지지는 않는다.

## 알아둘 것

- **성패는 `resultType`으로 판별한다.** 요청 오류도 HTTP 200으로 온다.
- 재시도: 429·500만 백오프 재시도. 400·401·403·404·쿼터 초과는 재시도해도 같다.
- `403 IP_NOT_ALLOWED` → 어드민에 이 서버의 공인 IP 미등록 (`curl https://api.ipify.org`).
- 초당 10회(버스트 30) 제한. `sync.py`는 호출 사이에 120ms를 둔다.
- 개인화 정보(쿠폰·배송지·적립)는 제공되지 않고, 성인 상품도 조회되지 않는다.
- 제공 데이터는 제휴 목적 범위 내에서만 쓸 것. 가격 크롤링·무단 재판매·대량 수집은 차단 사유.
