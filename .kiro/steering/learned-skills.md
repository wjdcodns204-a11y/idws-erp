---
inclusion: always
---
# Learned Skills & Best Practices

이 문서는 프로젝트를 진행하며 성공적으로 검증된 패턴과 스킬을 누적하는 문서입니다.
새로운 작업을 시작하기 전 반드시 이 내용을 숙지하고 적용하십시오.

---

## 누적된 스킬 목록

### 스킬 #1: Google Shared Drive에서 Next.js 개발 서버 실행하기
- 날짜: 2026-03-05
- 상황: 프로젝트가 Google Shared Drive(G: 드라이브)에 위치해 있어 `npm install`, `next build` 등 파일 I/O가 많은 작업이 타임아웃되거나 `EBADF`, `EPERM` 에러 발생
- 문제 원인: Google Drive File Stream이 파일 핸들을 잠가서 npm의 tar 압축 해제가 실패함. Junction(심볼릭 링크)도 Google Drive 파일 시스템에서 지원하지 않음
- 해결 방법:
  1. `package.json`과 `package-lock.json`을 로컬 C 드라이브 임시 폴더(`C:\temp\idws-install`)로 복사
  2. 로컬에서 `npm install` 실행 (파일 잠금 문제 없이 정상 완료)
  3. `NODE_PATH` 환경변수를 로컬 node_modules 경로로 설정
  4. `node "C:\temp\idws-install\node_modules\next\dist\bin\next" dev` 명령으로 개발 서버 실행
- 핵심 명령어:
  ```powershell
  # 로컬에 패키지 설치
  Set-Location "C:\temp\idws-install"
  npm install

  # G 드라이브 프로젝트에서 로컬 node_modules 참조하여 서버 실행
  $env:NODE_PATH="C:\temp\idws-install\node_modules"
  node "C:\temp\idws-install\node_modules\next\dist\bin\next" dev
  ```
- 결과: Next.js 16.1.6 (Turbopack) 개발 서버가 `http://localhost:3000`에서 정상 실행됨
- 교훈: Google Shared Drive에서는 node_modules를 직접 설치/사용하지 말고, 로컬 드라이브에 설치 후 NODE_PATH로 연결하는 우회 방식을 사용할 것

### 스킬 #2: src (1) 중복 폴더 정리
- 날짜: 2026-03-05
- 상황: `idws-erp/src (1)/` 폴더가 42개 파일과 함께 존재하여 빌드 충돌 가능성 있음
- 해결: `Remove-Item -Path 'idws-erp/src (1)' -Recurse -Force`로 삭제
- 교훈: 공유 드라이브에서 파일 동기화 충돌로 `(1)` 접미사가 붙은 중복 폴더가 생길 수 있으니, 작업 전 항상 확인할 것

### 스킬 #3: package.json과 node_modules 버전 불일치 감지
- 날짜: 2026-03-05
- 상황: `package.json`에는 `next: "16.1.6"`이 명시되어 있으나, 기존 node_modules에는 Next.js 15.3.2가 설치되어 있었음
- 영향: `npx next dev` 실행 시 npx가 새 버전을 다운로드하려고 시도하여 "Ok to proceed? (y)" 프롬프트에서 멈춤
- 해결: 로컬 C 드라이브에서 `npm install`을 새로 실행하여 올바른 버전(16.1.6) 설치
- 교훈: 개발 서버 실행 전 `node -e "console.log(require('next/package.json').version)"`으로 실제 설치된 버전을 확인할 것

### 스킬 #4: 인사(HR) & 업무(Tasks) 탭 추가 — 전체 흐름
- 날짜: 2026-03-05
- 상황: ERP에 인사 관리(직원, 출퇴근, 휴가)와 업무 관리(칸반 보드, 체크리스트, 댓글) 기능 추가
- 접근 방법:
  1. 계획서 먼저 작성 (`.kiro/plans/hr-and-tasks-tabs.md`) → 사용자 승인 후 진행
  2. Step 1: 사이드바 메뉴 추가 (`layout.tsx`에 메뉴 아이템 + `pathname.startsWith()` 패턴)
  3. Step 2: Prisma 스키마 확장 (Enum 5개 + Model 6개 + User 모델에 프로필 필드/릴레이션 추가)
  4. Step 3: 인사 관리 UI 4페이지 (직원 목록, 상세, 출퇴근, 휴가) — 샘플 데이터 기반
  5. Step 4: 업무 관리 UI 3페이지 (칸반 보드, 상세, 내 업무) — 샘플 데이터 기반
  6. Step 5: API 라우트 8개 생성 (Prisma 기반, DB 연동 준비 완료)
- 핵심 패턴:
  - Next.js App Router의 `RouteContext` 타입: `{ params: Promise<{ id: string }> }` (Next.js 16에서 params가 Promise)
  - 출퇴근 로직: 9시 이후 출근 → 지각(LATE), 18시 이전 퇴근 → 조퇴(EARLY_LEAVE)
  - 업무 상태 변경 시 `completedAt` 자동 기록/초기화
  - 체크리스트 sortOrder: 기존 최대값 + 1로 자동 증가
  - 휴가 승인/반려: ADMIN만 가능하도록 설계 (프론트에서 권한 체크)
- 생성된 파일 (총 15개):
  - UI: `hr/page.tsx`, `hr/[id]/page.tsx`, `hr/attendance/page.tsx`, `hr/leave/page.tsx`, `tasks/page.tsx`, `tasks/[id]/page.tsx`, `tasks/my/page.tsx`
  - API: `api/hr/employees/route.ts`, `api/hr/employees/[id]/route.ts`, `api/hr/attendance/route.ts`, `api/hr/leave/route.ts`, `api/tasks/route.ts`, `api/tasks/[id]/route.ts`, `api/tasks/[id]/comments/route.ts`, `api/tasks/[id]/checklist/route.ts`
- 교훈: DB 연동 전에도 Prisma import로 API 구조를 미리 잡아두면, 나중에 환경변수만 설정하면 바로 동작함. 샘플 데이터 UI → API 라우트 → DB 연동 순서가 효율적.

### 스킬 #5: 엑셀 데이터를 ERP에 반영하는 파이프라인
- 날짜: 2026-03-05
- 상황: 구글 시트 "[IDWS] 휴가관리대장"의 실제 직원/휴가 데이터를 ERP 인사 관리 페이지에 반영
- 접근 방법:
  1. 구글 시트 직접 접근 불가 → 엑셀 파일(.xlsx)을 프로젝트에 다운로드
  2. `scripts/export-hr-data.js` 스크립트로 엑셀 파싱 → JSON 변환
  3. `src/data/hr-data.json`에 저장 (직원 9명, 휴가 405건, 연차 현황, 추가휴가 현황)
  4. HR 페이지 3개에서 `import hrData from "@/data/hr-data.json"` 으로 실제 데이터 사용
- 엑셀 시트 구조 (6개 시트):
  - `휴가관리대장_관리자`: 직원별 연차 현황 (기본휴가, 가산, 사용, 잔여)
  - `RD`: 휴가 사용 기록 405건 (날짜, 종류, 일수, 승인자, 비고)
  - `IMPORT RD_ECOUNT`: 직원 마스터 (사번, 이름, 부서, 직급, 직책, 입사일, 퇴사일)
  - `IMPORT RD_PRIORITY`: 부서/직급/직책 우선순위
  - `추가현황`: 추가휴가 보유/소진 현황
  - `SETTING`: 연차가산 테이블 + 휴가 종류 17개
- 핵심 패턴:
  - Excel 날짜 시리얼 → ISO 변환: `new Date((serial - 25569) * 86400 * 1000)`
  - `NODE_PATH` 환경변수로 로컬 node_modules의 xlsx 라이브러리 참조
  - `resolveJsonModule: true` (tsconfig)로 JSON 직접 import 가능
- 직원 데이터 (9명):
  - 재직: 정채운(디자인팀/팀장), 이주영(영업팀), 조보훈(생산팀/팀장), 최정민(영업팀), 이민종(디자인팀), 방민우(디자인팀)
  - 퇴사: 김태웅(운영지원팀), 이주용(디자인팀), 이정근(영업팀)
- 휴가 종류 17개: 연차, 월차, 오전반차, 오후반차, 하계휴가, 병가, 오전병가, 오후병가, 여성보건휴가, 특별휴가, 경조휴가, 공가, 출산휴가, 돌봄휴가, 검진휴가, 급여차감무급휴가, 추가지급휴가
- 교훈: 구글 시트 API 접근이 안 될 때는 xlsx 다운로드 → 스크립트 파싱이 가장 빠른 우회법. JSON으로 변환해두면 프론트엔드에서 바로 import 가능.

---

## 현재 프로젝트 상태 (2026-03-05 기준)

### 환경
- 프로젝트 위치: `G:\공유 드라이브\IDWS\IDWS ERP\idws-erp`
- node_modules 위치: `E:\idws_erp\node_modules` (외장 SSD, 프로젝트 내부 직접 설치)
- 개발 서버: `http://localhost:3000` 실행 중 (Next.js 16.1.6 Turbopack)

### 완료된 작업
- [x] `src (1)/` 중복 폴더 삭제
- [x] TypeScript 에러 없음 확인
- [x] Google Drive 파일 잠금 우회하여 개발 서버 실행 성공
- [x] steering 규칙 파일 7개 전체 숙지 완료
- [x] `learned-skills.md` 생성 및 초기 스킬 기록
- [x] 이지어드민 API 문서 분석 및 `.kiro/docs/ezadmin-api.md` 정리
- [x] 인사(HR) 탭: UI 4페이지 + API 3개 라우트 완료
- [x] 업무(Tasks) 탭: UI 3페이지 + API 5개 라우트 완료
- [x] Prisma 스키마에 HR/Tasks 모델 추가 완료
- [x] 상품별 집계장 엑셀 데이터 → JSON 변환 완료 (397상품, 965 SKU, 29,644재고)

### 스킬 #6: 외장 SSD(exFAT)에서 Next.js 16 Turbopack 실행하기
- 날짜: 2026-03-05
- 상황: E드라이브가 외장 SSD(exFAT 파일시스템)이라 Junction/심볼릭 링크가 지원되지 않음. NODE_PATH로 외부 node_modules를 참조하면 Turbopack이 `next/package.json`을 찾지 못하는 에러 발생
- 에러 메시지: `We couldn't find the Next.js package (next/package.json) from the project directory`
- 시도한 방법들:
  1. `turbopack.root` 설정 → 실패 (외부 node_modules 경로는 인식 안 됨)
  2. `--no-turbopack` / `--turbopack=false` 옵션 → Next.js 16에서 지원 안 함
  3. `mklink /J` Junction → exFAT에서 지원 안 됨
- 해결 방법: E드라이브 프로젝트 폴더에 직접 `npm install` 실행하여 node_modules를 프로젝트 내부에 설치
- 핵심 명령어:
  ```powershell
  # E드라이브 프로젝트 폴더에서 직접 설치
  npm install --prefix "E:\idws_erp"
  # 프로젝트 내부 node_modules로 서버 실행
  node "E:\idws_erp\node_modules\next\dist\bin\next" dev
  ```
- 교훈: Turbopack은 NODE_PATH를 통한 외부 node_modules 참조를 지원하지 않음. 반드시 프로젝트 디렉토리 내에 node_modules가 있어야 함. exFAT 드라이브에서도 npm install은 정상 동작하지만 Junction은 불가.

### 스킬 #7: 상품별 집계장 엑셀 → ERP JSON 데이터 파이프라인
- 날짜: 2026-03-05
- 상황: `[IDWS] 상품별 집계장.xlsx`의 "월별 재고 현황" 시트(20,218행)에서 최신 날짜(2026-02-28) 데이터를 추출하여 ERP 상품/재고 페이지에 실제 데이터 반영
- 접근 방법:
  1. `scripts/analyze-product-data.js`로 엑셀 구조 분석 (시트 7개, 컬럼 21개)
  2. `scripts/export-product-data.js`로 엑셀 → JSON 변환
  3. 기존 무신사 상품 데이터에서 이미지 URL 매칭 (styleCode 기준)
  4. 3-Tier 구조 변환: SKU → styleCode(색상 포함) → 상품 그룹
- 엑셀 컬럼 매핑:
  - col[0]: 일자 (Excel 시리얼), col[4]: 상품코드(=SKU), col[5]: 상품명
  - col[6]: 바코드, col[7]: 로케이션, col[9]: 년도, col[10]: 시즌
  - col[13]: 재고수량, col[14]/col[20]: 원가
- 카테고리 코드 매핑: 스타일코드에서 시즌 뒤 2글자로 카테고리 추출
  - JK=자켓(OUTER), TS=티셔츠(TOP), PT=팬츠(BOTTOM), AC=액세서리(ACC) 등 27개 매핑
- 결과:
  - 상품 397개 스타일 (판매중 316, 품절 81)
  - SKU 965개, 총 재고 29,644개, 재고 금액 661,189,438원
  - 이미지 매칭 397개 (기존 무신사 데이터에서 100% 매칭)
- 생성 파일:
  - `scripts/export-product-data.js` (변환 스크립트)
  - `public/data/musinsa-products.json` (상품 목록 397개)
  - `public/data/inventory.json` (재고 현황 965개 SKU)
- 교훈: 엑셀 데이터 변환 시 기존 JSON 데이터의 형식을 정확히 유지해야 UI 코드 수정 없이 바로 반영됨. 이미지 URL은 기존 데이터에서 styleCode 기준으로 매칭하면 효율적.


### 스킬 #8: MVP 인증 시스템 구현 패턴 (localStorage 기반)
- 날짜: 2026-03-05
- 상황: Supabase API 키 미제공 상태에서 인증/사용자 관리 기능을 MVP로 구현
- 접근 방법:
  1. 듀얼 모드 설계: Supabase 환경변수 유무에 따라 자동 전환
     - 환경변수 있음 → Supabase Auth (signInWithPassword, resetPasswordForEmail)
     - 환경변수 없음 → localStorage 기반 MVP 모드 (테스트 계정 3개)
  2. 세션 관리: `src/lib/session.ts`에 getSession/clearSession/getUserRole 등 유틸리티
  3. 권한 관리: `public/data/permissions.json`에 역할별 메뉴 접근 권한 정의
  4. 감사 로그: `src/lib/audit.ts`에 logAudit/getAuditLogs — localStorage에 최대 500건 보관
  5. 미들웨어: Supabase 모드에서만 서버 사이드 인증 체크 (MVP에서는 클라이언트 체크)
- 핵심 패턴:
  - MVP 테스트 계정: admin@idws.co.kr/admin1234, md@idws.co.kr/md1234, viewer@idws.co.kr/viewer1234
  - 로그인 실패 5회 → 30초 잠금 (클라이언트 카운트)
  - 세션 만료: 24시간 (expiresAt 타임스탬프 비교)
  - 역할 기반 메뉴 필터링: permissions.json fetch → canAccessMenu() 함수로 사이드바 필터
  - 설정 메뉴 하위 구조: 사용자 관리, 권한 설정, 활동 로그 (토글 방식)
- 생성/수정된 파일 (11개):
  - 신규: session.ts, permissions.json, users.json, audit-logs.json, settings/users/page.tsx, settings/permissions/page.tsx, settings/logs/page.tsx
  - 수정: login/page.tsx, layout.tsx, middleware.ts, audit.ts
- 교훈:
  - exFAT 외장 SSD에서 fsWrite/strReplace/editCode 도구가 EPERM 에러 발생 → Node.js 스크립트(fs.writeFileSync)로 우회 필수
  - JSX가 포함된 파일은 문자열 리터럴로 생성하기 어려움 → 기존 파일을 읽어서 string.replace()로 부분 수정하는 패턴이 안전
  - 미들웨어에서 localStorage 접근 불가 (서버 사이드) → MVP에서는 클라이언트 사이드 세션 체크로 대체

### 스킬 #9: 재고 관리 강화 — 6단계 구현 패턴
- 날짜: 2026-03-05
- 상황: 재고 관리 페이지에 오프라인 매장, 안전재고 동적 계산, 이지어드민 API 동기화, 리오더 관리, 재고 리포트, 대시보드 위젯 등 6개 기능을 단계별로 추가
- 접근 방법:
  1. Step 6(데이터 추출) 먼저 → 나머지 Step이 의존하는 데이터 확보
  2. 엑셀 "전체 size" 시트에서 weeklyAvgSales, expectedDaysToSell 추출 → inventory.json에 병합
  3. 기존 페이지(~1020줄)는 수정만, 새 기능(리오더/리포트)은 별도 페이지로 분리
  4. 대시보드 위젯은 fetch("/data/inventory.json")으로 실시간 데이터 로드
  5. 사이드바 서브메뉴는 설정 메뉴와 동일한 토글 패턴 재사용
- 핵심 패턴:
  - 안전재고 기준: 고정 수량(20개) → 예상 소진일(45일) 기반 동적 계산
  - Excel "예상 소진일" 컬럼: 날짜 시리얼(46333) → Date 변환 → today 차이 = 남은 일수
  - 리오더 모달: 여러 품번 동시 입력 + 사이즈별 수량 + datalist 자동완성
  - 재고 리포트: 시즌별/카테고리별/창고별 집계 + 엑셀 다운로드(다중 시트)
  - 대시보드 위젯: "use client" + useEffect fetch + 소진일 색상 분기(14일/30일/45일)
  - 사이드바 배지: inventory.json fetch → expectedDaysToSell ≤ 45 카운트 → 빨간 배지
- 생성된 파일 (8개 스크립트 + 3개 신규 페이지 + 2개 수정):
  - 스크립트: export-sales-data.js, step1~step4, step5-dashboard-widget.js, step5b-sidebar-submenu.js
  - 신규: reorder/page.tsx, report/page.tsx, reorders.json
  - 수정: inventory/page.tsx, page.tsx(대시보드), layout.tsx(사이드바)
- 교훈:
  - 데이터 의존성이 있는 작업은 데이터 추출을 최우선으로 실행
  - 1000줄 이상 파일은 새 기능을 별도 페이지로 분리하여 관리
  - 사이드바 서브메뉴 패턴은 재사용 가능 (설정 메뉴와 동일 구조)
  - 대시보드 위젯은 JSON fetch 방식이 가장 간단하고 유지보수 용이


### 스킬 #10: 주문 관리 페이지 구현 패턴 (JSON 기반 MVP)
- 날짜: 2026-03-05
- 상황: ERP에 주문 관리 기능 추가 — 주문 목록, 상세, 일괄 상태 변경, 대시보드 연동
- 접근 방법:
  1. 샘플 주문 데이터 30건 생성 (orders.json) — 실제 상품 데이터(musinsa-products.json)에서 styleCode/이미지 참조
  2. 주문 목록 페이지: KPI 카드 4개, 상태별 탭, 검색/필터, 체크박스 선택, CSV 다운로드
  3. 주문 상세 페이지: 상품 목록(이미지 포함), 금액 요약, 고객/배송 정보, 상태 변경 버튼, 이력 타임라인
  4. 일괄 상태 변경 강화: 선택 주문 상태 동일성 검증, 허용 전환만 드롭다운 표시, 배송시작 시 운송장 일괄 입력
  5. 대시보드 연동: orders.json fetch → KPI/최근주문/채널별매출 실제 데이터 반영
- 핵심 패턴:
  - order-state.ts의 ALLOWED_TRANSITIONS 맵을 프론트엔드에서도 동일하게 유지 (상태 머신 일관성)
  - musinsa-products.json은 FLAT 구조 (variants 배열 없음) — styleCode에 색상코드 포함 (예: I25SSTS002-BK)
  - 일괄 변경 시 selectedStatuses 분석 → isSameStatus 플래그로 UI 분기
  - 대시보드 KPI는 하드코딩 → fetch 기반으로 전환 시 상태변수 + useEffect 패턴
  - Node.js 스크립트로 파일 수정 시 CRLF 정규화 필수: .replace(/\r\n/g, '\n')
- 생성된 파일:
  - public/data/orders.json (샘플 30건)
  - src/app/(dashboard)/orders/page.tsx (목록)
  - src/app/(dashboard)/orders/[id]/page.tsx (상세)
  - scripts/gen-orders.js, order-step2~5 스크립트들
- 교훈:
  - 주문 상태 머신은 프론트/백엔드 양쪽에서 동일한 전환 규칙을 유지해야 UX 일관성 확보
  - 일괄 변경은 "같은 상태의 주문만 선택" 제약이 있어야 안전 (다른 상태 혼합 시 경고)
  - 대시보드 하드코딩 데이터를 실제 JSON fetch로 전환하면 유지보수가 훨씬 쉬움



### 스킬 #11: 정산 관리 페이지 구현 패턴
- 날짜: 2026-03-05
- 상황: ERP에 정산 관리 기능 추가 — 채널별 수수료 계산, 정산 현황, 채널 상세, 대시보드 위젯
- 접근 방법:
  1. orders.json 기반 정산 데이터 자동 생성 (채널별 수수료율 적용)
  2. 정산 현황 메인: KPI 4개, 채널별 카드(Link), 필터+테이블, 정산 완료 처리, 월별 추이
  3. 채널별 상세: 요약 카드, 월별 바 차트(CSS), 주문별 테이블, CSV 다운로드
  4. 대시보드 위젯: settlements.json fetch → 이번 달 채널별 매출/수수료/순매출
- 핵심 패턴:
  - 수수료 계산: Math.floor(saleAmount * commissionRate / 100) — 소수점 절사
  - 정산일 계산: 월 정산(dueDays 배열) vs D+3(자사몰) 분기
  - 과거 월 가상 데이터: 월별 추이 시각화를 위해 1~2월 집계 데이터 추가
  - CSS 바 차트: height를 (value/maxValue)*120px로 계산, flex items-end로 정렬
  - 채널 상세 라우트: encodeURIComponent/decodeURIComponent로 한글 채널명 처리
- 채널별 수수료: 무신사 30%, 29CM 25%, 자사몰 3.5%(PG), LLUD 28%
- 생성된 파일:
  - public/data/settlements.json
  - src/app/(dashboard)/settlement/page.tsx
  - src/app/(dashboard)/settlement/[channel]/page.tsx
- 교훈: 정산 데이터는 주문 데이터에서 파생(derive)하면 일관성 유지가 쉬움. 월별 추이는 과거 가상 데이터를 넣어야 차트가 의미 있음.

### 미완료 / 다음 작업 후보
- [x] Supabase 환경변수 설정 완료
- [ ] Prisma Client 재생성 (`npx prisma generate` — 로컬 환경에서)
- [x] 주문 관리 페이지 구현
- [x] 정산 관리 페이지 구현
- [ ] 채널 어댑터 실제 API 연동
- [ ] 이지어드민 API 실제 연동 (partner_key, domain_key 사용자 제공 대기)

### 스킬 #12: JSON → Supabase DB 전환 패턴 (전체 ERP 페이지)
- 날짜: 2026-03-05
- 상황: ERP 전체 페이지(대시보드, 상품, 재고, 주문, 정산, 인사, 설정)를 JSON 파일 기반에서 Supabase DB 기반으로 전환
- 접근 방법:
  1. `src/lib/supabase.ts`에 헬퍼 함수 추가: `getSupabase()`, `isSupabaseConfigured()`, `queryTable<T>()`, `insertRow<T>()`, `updateRow<T>()`
  2. 클라이언트 페이지: `isSupabaseConfigured()` → DB 쿼리 → 실패 시 JSON fetch 폴백
  3. API 라우트: `createSupabaseAdmin()` (Service Role Key) → DB 쿼리 → 실패 시 JSON 파일 폴백
  4. 정적 import(`import hrData from "@/data/hr-data.json"`) → `useEffect` + Supabase 쿼리 + 폴백 변수로 전환
- 핵심 패턴:
  - DB 컬럼(snake_case) → 프론트엔드 인터페이스(camelCase) 매핑 필수
  - 클라이언트: `getSupabase()` (anon key, RLS 적용)
  - 서버 API: `createSupabaseAdmin()` (service role key, RLS 우회)
  - 폴백 패턴: `if (isSupabaseConfigured()) { try { DB } catch { } } // JSON 폴백`
  - 정산 데이터: DB에서 settlements 조회 후 monthlySummary/channelConfig를 클라이언트에서 계산
  - 권한 데이터: role_permissions 테이블의 menu_key → 라우트 경로 매핑 (dashboard→/, plm→/products 등)
- 전환된 파일 (총 17개):
  - 헬퍼: `src/lib/supabase.ts`
  - 대시보드: `page.tsx`, `layout.tsx`
  - 상품: `products/page.tsx`, `products/[styleCode]/page.tsx`
  - 재고 API: `api/inventory/route.ts`, `reorder/route.ts`, `transaction/route.ts`, `upload/route.ts`
  - 주문: `orders/page.tsx`, `orders/[id]/page.tsx`
  - 정산: `settlement/page.tsx`, `settlement/[channel]/page.tsx`
  - 인사: `hr/page.tsx`, `hr/[id]/page.tsx`, `hr/leave/page.tsx`
  - 설정: `settings/users/page.tsx`, `settings/permissions/page.tsx`
- DB 테이블 매핑:
  - products, inventory_details, orders, settlements, employees, leaves, role_permissions, reorder_requests, inventory_transactions
- 교훈:
  - exFAT 외장 SSD에서는 fsWrite/strReplace 도구가 EPERM → Node.js 스크립트(`fs.writeFileSync`)로 우회 필수
  - CRLF 정규화(`.replace(/\r\n/g, '\n')`) 없이 문자열 매칭하면 실패
  - 정적 import(`import x from "@/data/x.json"`)는 useEffect + state로 전환해야 DB 폴백 가능
  - API 라우트에서는 `createSupabaseAdmin()` 사용 (서버 사이드에서 anon key는 RLS 제약)

### 스킬 #13: Google Shared Drive 파일 유실 복구 패턴
- 날짜: 2026-03-06
- 상황: Google Shared Drive 동기화 과정에서 20개 파일이 유실됨 (유틸리티, 설정 페이지, 상세 페이지, 재고 서브페이지, API 라우트)
- 접근 방법:
  1. learned-skills.md의 구현 내역과 실제 파일시스템을 대조하여 누락 파일 20개 식별
  2. 의존성 순서로 5단계 복구 계획 수립: 핵심 유틸리티 → 설정 페이지 → 상세 페이지 → 재고 서브페이지 → API 라우트
  3. 각 파일을 기존 코드 스타일/패턴과 동일하게 재생성 (Supabase 우선 + JSON 폴백)
  4. 단계별 diagnostics 검증으로 에러 없음 확인
- 복구된 파일 (20개):
  - 유틸리티: `session.ts`, `hr-data.json`
  - 설정: `settings/users/page.tsx`, `settings/permissions/page.tsx`, `settings/logs/page.tsx`
  - 상세: `hr/[id]/page.tsx`, `orders/[id]/page.tsx`, `settlement/[channel]/page.tsx`, `tasks/[id]/page.tsx`, `tasks/my/page.tsx`
  - 재고: `inventory/reorder/page.tsx`, `inventory/report/page.tsx`
  - API: `api/inventory/route.ts`, `api/hr/employees/route.ts`, `api/hr/employees/[id]/route.ts`, `api/hr/attendance/route.ts`, `api/tasks/route.ts`, `api/tasks/[id]/route.ts`, `api/tasks/[id]/comments/route.ts`, `api/tasks/[id]/checklist/route.ts`
- 핵심 패턴:
  - Next.js 16 RouteContext: `{ params: Promise<{ id: string }> }` — params가 Promise 타입
  - 체크리스트 sortOrder 자동 증가: 기존 최대값 조회 → +1
  - 출퇴근 자동 판정: 9시 이후 출근 → 지각(LATE), 18시 이전 퇴근 → 조퇴(EARLY_LEAVE)
  - 업무 상태 변경 시 completedAt 자동 기록/초기화
- 교훈:
  - Google Shared Drive 동기화 충돌로 파일이 무음 유실될 수 있음 → 정기적으로 navigation.md와 실제 파일 대조 필요
  - 복구 시 의존성 순서(유틸리티 → UI → API)로 진행해야 중간 단계에서도 빌드 가능
  - learned-skills.md에 구현 내역을 상세히 기록해두면 복구 시 설계 문서 역할을 함
