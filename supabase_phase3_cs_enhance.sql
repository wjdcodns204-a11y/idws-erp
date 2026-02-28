-- Phase 3: CS 강화 — 배송추적, 블랙리스트
-- ⚠️ Supabase SQL Editor에서 실행해주세요

-- 1) cs_requests에 배송 추적 필드 추가
ALTER TABLE public.cs_requests
    ADD COLUMN IF NOT EXISTS tracking_number text,           -- 운송장 번호
    ADD COLUMN IF NOT EXISTS carrier text DEFAULT '미지정'  
        CHECK (carrier IN ('CJ대한통운', '롯데택배', '한진택배', '우체국', 'GS25', '쿠팡', '미지정')),
    ADD COLUMN IF NOT EXISTS exchange_item text,             -- 교환 요청 상품
    ADD COLUMN IF NOT EXISTS refund_amount bigint DEFAULT 0; -- 환불 금액

-- 2) 고객 블랙리스트 테이블
CREATE TABLE IF NOT EXISTS public.customer_blacklist (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_name text NOT NULL,         -- 블랙리스트 고객명
    platform text,                       -- 주로 사용하는 플랫폼
    reason text NOT NULL,               -- 등록 사유 (예: 상습 반품, 사기 의심)
    cs_count int DEFAULT 1,             -- CS 접수 횟수
    registered_by text,                 -- 등록자
    created_at timestamp with time zone DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_blacklist_name ON public.customer_blacklist(customer_name);
