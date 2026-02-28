---
description: 이지어드민(EZAdmin) 웹 스크래핑으로 재고/주문 데이터를 ERP에 연동하는 방법
---

# 이지어드민 웹 스크래핑 연동

## 개요

이지어드민(<www.ezadmin.co.kr)에> Puppeteer로 자동 로그인하여 재고/주문 데이터를 ERP에 가져오는 기능.

## 로그인 방식 (RSA 암호화)

이지어드민은 단순 HTTP POST가 아닌 **RSA 암호화** 로그인을 사용하므로 반드시 **Puppeteer(브라우저 자동화)**가 필요합니다.

### 로그인 흐름

1. `https://www.ezadmin.co.kr/index.html` 접속
2. 팝업 강제 표시: `#login-popup` display:block
3. 폼 입력: `#login-domain`, `#login-id`, `#login-pwd`
4. RSA 암호화: `encrypt(loginform.serialize())`  → `#encpar` value에 설정
5. `#encform` action을 `/login_process40.php`로 설정
6. `#encform` submit
7. `ga16.ezadmin.co.kr` (관리자 대시보드)로 리다이렉트

### 핵심 코드 패턴

```typescript
// 1) 팝업 열기
await page.evaluate(() => {
    const popup = document.querySelector('#login-popup');
    if (popup) popup.style.display = 'block';
});

// 2) 입력
await page.type('#login-domain', DOMAIN);
await page.type('#login-id', ID);
await page.type('#login-pwd', PW);

// 3) RSA 암호화 + 제출
await page.evaluate(() => {
    document.querySelector('#encform').action = '/login_process40.php';
    const formEl = document.querySelector('form[name="loginform"]');
    const params = new URLSearchParams(new FormData(formEl)).toString();
    const encrypted = encrypt(params);
    document.querySelector('#encpar').value = encrypted;
});

// 4) 네비게이션 대기
await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }),
    page.evaluate(() => document.querySelector('#encform').submit()),
]);
```

## 환경변수 (.env)

```
EZADMIN_DOMAIN=reto123
EZADMIN_ID=idws
EZADMIN_PW=비밀번호
EZADMIN_BASE_URL=https://www.ezadmin.co.kr
```

> ⚠️ .env 변경 후 반드시 서버 재시작 필요 (`npm run dev` 재실행)

## 관리자 URL 구조

- 기본: `https://ga16.ezadmin.co.kr`
- 모든 페이지: `template35.htm?template=코드` 패턴
- 주문수집: `template=DS00`
- 주문처리: `template=E807`
- 발주: `template=DL03`
- 계정정보: `template=BA00`

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/services/ezadmin-scraper.ts` | 로그인 + 재고/주문/탐색 스크래퍼 서비스 |
| `src/app/api/ezadmin/scrape/route.ts` | API 엔드포인트 (POST) |
| `src/app/(dashboard)/products/page.tsx` | 이지어드민 재고 동기화 버튼 |

## API 사용법

```
POST /api/ezadmin/scrape
Body: { "type": "explore" }  → 사이트 메뉴 탐색
Body: { "type": "stock" }    → 재고 스크래핑 + 상품 반영
Body: { "type": "orders" }   → 주문 수집
Body: { "type": "close" }    → 브라우저 종료
```

## 성능 팁

- `setRequestInterception(true)`로 이미지/폰트/미디어 차단 → 빠른 로딩
- `waitUntil: 'domcontentloaded'` 사용 (`networkidle2`는 너무 느림)
- RSA JS 로드 대기: `setTimeout(5000)` 필요
- `protocolTimeout: 120000` 설정 필수

## 트러블슈팅

| 문제 | 해결 |
|------|------|
| `Runtime.callFunctionOn timed out` | `protocolTimeout: 120000` 설정 |
| `.login-btn` 클릭 안됨 | 팝업이 숨겨져 있음 → `#login-popup` display:block 필요 |
| `DNS_PROBE_FINISHED_NXDOMAIN` | URL이 `reto123.ezadmin.co.kr`이 아니라 `www.ezadmin.co.kr`임 |
| 로그인 후 context destroyed | 정상 동작 — 네비게이션으로 인한 것이므로 catch 처리 |
