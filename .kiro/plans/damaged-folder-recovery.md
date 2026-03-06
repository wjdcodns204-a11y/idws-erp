# 손상된 폴더 확인 및 복구 계획서 ✅ 완료 (2026-03-06)

## 상황 분석
learned-skills.md에 기록된 구현 내역 대비 현재 프로젝트에서 다수의 파일/폴더가 누락됨.
Google Shared Drive 동기화 과정에서 파일이 유실된 것으로 추정.

## 손상/누락 현황

### 🔴 핵심 유틸리티 (다른 파일들이 import하는 의존성)
| 파일 | 역할 | 참조하는 파일 |
|------|------|--------------|
| `src/lib/session.ts` | 세션 관리 (getSession, clearSession, getUserRole 등) | layout.tsx, audit.ts, login/page.tsx |
| `src/data/hr-data.json` | HR 직원/휴가 데이터 | hr/page.tsx, hr/leave/page.tsx |

### 🟡 빈 폴더 (파일 유실)
| 폴더 | 원래 있어야 할 파일 |
|------|-------------------|
| `src/app/api/inventory/` | route.ts (재고 조회 API) |
| `src/app/api/hr/employees/` | route.ts, [id]/route.ts |
| `src/app/api/tasks/[id]/` | route.ts, comments/route.ts, checklist/route.ts |
| `src/app/(dashboard)/settings/` | users/page.tsx, permissions/page.tsx, logs/page.tsx |

### 🟠 완전 누락 (폴더+파일 모두 없음)
| 경로 | 역할 |
|------|------|
| `src/app/api/hr/attendance/route.ts` | 출퇴근 API |
| `src/app/api/tasks/route.ts` | 업무 목록 API |
| `src/app/(dashboard)/hr/[id]/page.tsx` | 직원 상세 페이지 |
| `src/app/(dashboard)/tasks/[id]/page.tsx` | 업무 상세 페이지 |
| `src/app/(dashboard)/tasks/my/page.tsx` | 내 업무 페이지 |
| `src/app/(dashboard)/inventory/reorder/page.tsx` | 리오더 관리 페이지 |
| `src/app/(dashboard)/inventory/report/page.tsx` | 재고 리포트 페이지 |
| `src/app/(dashboard)/orders/[id]/page.tsx` | 주문 상세 페이지 |
| `src/app/(dashboard)/settlement/[channel]/page.tsx` | 채널별 정산 상세 |

## 복구 순서 (의존성 기준)

### Step 1: 핵심 유틸리티 복구 ✅
1. `src/lib/session.ts` — 세션 관리 (layout.tsx, audit.ts, login/page.tsx가 의존)
2. `src/data/hr-data.json` — HR 데이터 (hr/page.tsx, hr/leave/page.tsx가 의존)

### Step 2: 설정 페이지 복구 ✅
3. `src/app/(dashboard)/settings/users/page.tsx`
4. `src/app/(dashboard)/settings/permissions/page.tsx`
5. `src/app/(dashboard)/settings/logs/page.tsx`

### Step 3: 상세 페이지 복구 ✅
6. `src/app/(dashboard)/hr/[id]/page.tsx`
7. `src/app/(dashboard)/orders/[id]/page.tsx`
8. `src/app/(dashboard)/settlement/[channel]/page.tsx`
9. `src/app/(dashboard)/tasks/[id]/page.tsx`
10. `src/app/(dashboard)/tasks/my/page.tsx`

### Step 4: 재고 서브페이지 복구 ✅
11. `src/app/(dashboard)/inventory/reorder/page.tsx`
12. `src/app/(dashboard)/inventory/report/page.tsx`

### Step 5: API 라우트 복구 ✅
13. `src/app/api/inventory/route.ts` ✅
14. `src/app/api/hr/employees/route.ts` ✅
15. `src/app/api/hr/employees/[id]/route.ts` ✅
16. `src/app/api/hr/attendance/route.ts` ✅
17. `src/app/api/tasks/route.ts` ✅
18. `src/app/api/tasks/[id]/route.ts` ✅
19. `src/app/api/tasks/[id]/comments/route.ts` ✅
20. `src/app/api/tasks/[id]/checklist/route.ts` ✅

## 복구 원칙
- 기존 코드 스타일/패턴 유지 (Supabase 우선 + JSON 폴백)
- learned-skills.md에 기록된 패턴 준수
- 한국어 주석, any 타입 금지
- 파일당 150~500줄 이내
