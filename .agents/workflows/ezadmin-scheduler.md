---
description: 이지어드민 주문/재고 자동 수집 스케줄러 설정 및 사용법
---

# 이지어드민 자동 수집 스케줄러

## 개요

매일 **오전 8시, 오후 12시**에 이지어드민에서 재고/주문 데이터를 자동으로 수집합니다.

## 스케줄

| 시간 | 작업 |
|------|------|
| 매일 오전 8시 | 주문 수집 → 재고 수집 |
| 매일 오후 12시 | 주문 수집 → 재고 수집 |

## 파일 구조

| 파일 | 역할 |
|------|------|
| `src/services/ezadmin-scheduler.ts` | node-cron 스케줄러 (8시/12시 등록) |
| `src/instrumentation.ts` | Next.js 서버 시작 시 스케줄러 자동 등록 |
| `src/services/ezadmin-scraper.ts` | 스크래핑 서비스 (로그인, 재고/주문 수집) |
| `src/app/api/ezadmin/scrape/route.ts` | API 엔드포인트 |

## 저장 위치

- 주문: `public/data/ezadmin-orders.json` (주문번호 기준 자동 병합)
- 재고: `public/data/musinsa-products.json` (상품코드에 재고 반영)

## 수동 실행

```bash
# 주문 수집
curl -X POST http://localhost:3000/api/ezadmin/scrape -H "Content-Type: application/json" -d "{\"type\":\"orders\"}"

# 재고 수집
curl -X POST http://localhost:3000/api/ezadmin/scrape -H "Content-Type: application/json" -d "{\"type\":\"stock\"}"
```

## 스케줄 변경

`src/services/ezadmin-scheduler.ts`에서 cron 표현식 수정:

```typescript
// 분 시 일 월 요일
cron.schedule('0 8 * * *', ...)   // 매일 오전 8시
cron.schedule('0 12 * * *', ...)  // 매일 오후 12시
```

다른 시간 예시:

- `'0 9 * * 1-5'` → 평일 오전 9시만
- `'0 */3 * * *'` → 3시간마다
- `'30 8,14,18 * * *'` → 8:30, 14:30, 18:30

## 주의사항

- `npm run dev` 서버가 실행 중이어야 스케줄러 동작
- 서버 재시작 시 자동으로 스케줄러 재등록
- 콘솔에 `[스케줄러] 이지어드민 자동 수집 등록됨` 메시지 확인
