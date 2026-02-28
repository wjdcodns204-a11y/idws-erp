-- Phase 2: 발주 관리 시스템
-- Supabase SQL Editor에서 실행해주세요

-- 공급업체 테이블
CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,                    -- 공급업체명 (예: 삼성섬유)
    contact_name text,                     -- 담당자명
    contact_phone text,                    -- 연락처
    contact_email text,                    -- 이메일
    lead_time_days int DEFAULT 14,         -- 평균 납기일 (일)
    payment_terms text DEFAULT '선불',     -- 결제 조건
    memo text,
    created_at timestamp with time zone DEFAULT now()
);

-- 발주서 테이블
CREATE TABLE IF NOT EXISTS public.purchase_orders (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    po_number text UNIQUE NOT NULL,        -- 발주 번호 (예: PO-2026-001)
    supplier_id uuid REFERENCES public.suppliers(id),
    supplier_name text NOT NULL,           -- 공급업체명 (조회용 중복 저장)
    status text DEFAULT '초안' CHECK (status IN ('초안', '승인대기', '발주완료', '납품중', '입고완료', '취소')),
    ordered_date date,                     -- 발주 날짜
    expected_date date,                    -- 예상 납품일
    received_date date,                    -- 실제 입고일
    total_amount bigint DEFAULT 0,        -- 총 발주 금액
    memo text,
    created_by text,                       -- 작성자
    approved_by text,                      -- 승인자
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- 발주 품목 테이블 (발주서 1개당 여러 상품)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    po_id uuid REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_name text NOT NULL,            -- 상품명
    sku text,                              -- SKU 코드
    quantity int NOT NULL DEFAULT 1,       -- 발주 수량
    unit_price bigint DEFAULT 0,           -- 단가 (원)
    received_quantity int DEFAULT 0,       -- 실제 입고 수량
    memo text,
    created_at timestamp with time zone DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_po_status ON public.purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_poi_po_id ON public.purchase_order_items(po_id);

-- 발주 번호 자동 생성 함수
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS text AS $$
DECLARE
    year_str text;
    seq_num int;
    po_num text;
BEGIN
    year_str := to_char(now(), 'YYYY');
    SELECT COUNT(*) + 1 INTO seq_num
    FROM public.purchase_orders
    WHERE po_number LIKE 'PO-' || year_str || '-%';
    po_num := 'PO-' || year_str || '-' || LPAD(seq_num::text, 3, '0');
    RETURN po_num;
END;
$$ LANGUAGE plpgsql;

-- 기본 공급업체 샘플 데이터
INSERT INTO public.suppliers (name, contact_name, lead_time_days, payment_terms)
VALUES 
    ('주 공급업체', '담당자', 14, '선불'),
    ('원단 공급업체', '담당자', 7, '30일 후불')
ON CONFLICT DO NOTHING;
