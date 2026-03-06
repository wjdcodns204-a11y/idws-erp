# Phase 1 나머지: Prisma 스키마 보완 + JSON→DB 마이그레이션

> 상태: Step A(소프트삭제 SQL) 사용자 실행 대기 / 나머지 완료
> 작성일: 2026-03-06

---

## 완료된 작업

### Step B: DB 테이블 현황 확인 - DONE
- 모든 테이블 존재 확인 (34개)
- products 397행, inventory_details 965행, orders 30행, settlements 16행 등

### Step C~F: 누락 데이터 마이그레이션 - DONE
- employees: 6명 -> 9명 (퇴사자 3명 추가)
- leaves: 342건 -> 364건 (22건 추가)
- 주문/정산/권한: 이미 DB에 있음

### Step A: 소프트 삭제 + 버전 관리 - 사용자 실행 대기
- Supabase RPC 미지원으로 Dashboard SQL Editor에서 수동 실행 필요
- SQL 12개 문 제공 완료 (deleted_at, version 컬럼 + 인덱스)
