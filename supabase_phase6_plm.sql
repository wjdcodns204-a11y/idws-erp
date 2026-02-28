-- Phase 6: 상품/PLM 강화 — 샘플, 원단공급업체, 사이즈 스펙, QR 연동
-- ⚠️ Supabase SQL Editor에서 실행해주세요

-- ① 샘플 관리 테이블
CREATE TABLE IF NOT EXISTS public.samples (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name text NOT NULL,              -- 샘플명
    sku text,                                -- 상품코드
    category text,                           -- 카테고리
    sample_type text DEFAULT '1차샘플' CHECK (sample_type IN ('1차샘플', '2차샘플', '최종샘플', '판매샘플')),
    status text DEFAULT '제작중' CHECK (status IN ('제작중', '검토중', '수정요청', '승인', '반려', '회수')),
    quantity int DEFAULT 1,                  -- 샘플 수량
    factory_name text,                       -- 제작 공장
    expected_date date,                      -- 예상 납기일
    received_date date,                      -- 실제 수령일
    return_date date,                        -- 반출일
    location text DEFAULT '사내보관',        -- 현재 위치
    color text,                              -- 색상
    size_spec text,                          -- 사이즈
    memo text,
    created_by text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_samples_status ON public.samples(status);

-- ② 원단/소재 공급업체 테이블
CREATE TABLE IF NOT EXISTS public.fabric_suppliers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,                      -- 업체명
    category text DEFAULT '원단' CHECK (category IN ('원단', '부자재', '원사', '염색', '봉제', '기타')),
    contact_name text,
    contact_phone text,
    contact_email text,
    lead_time_days int DEFAULT 14,
    unit_price_range text,                   -- 단가 범위 (예: '5,000~10,000원/m')
    specialty text,                          -- 주력 소재
    address text,
    payment_terms text DEFAULT '30일 후불',
    rating int DEFAULT 3 CHECK (rating BETWEEN 1 AND 5),  -- 업체 평점
    is_active boolean DEFAULT true,
    memo text,
    created_at timestamp with time zone DEFAULT now()
);

-- ③ 사이즈 스펙 테이블
CREATE TABLE IF NOT EXISTS public.size_specs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_name text NOT NULL,              -- 상품명
    sku text,
    season text,                             -- 시즌 (예: '26SS')
    size_label text NOT NULL,               -- 사이즈명 (XS, S, M, L, XL)
    -- 상의 기준 (cm 단위)
    total_length numeric(5,1),              -- 총장
    chest numeric(5,1),                     -- 가슴둘레
    shoulder numeric(5,1),                  -- 어깨너비
    sleeve numeric(5,1),                    -- 소매길이
    waist numeric(5,1),                     -- 허리둘레
    -- 하의 기준
    hip numeric(5,1),                       -- 힙둘레
    thigh numeric(5,1),                     -- 허벅지둘레
    rise numeric(5,1),                      -- 밑위
    inseam numeric(5,1),                    -- 밑단
    hem_width numeric(5,1),                 -- 밑단 너비
    memo text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sizespec_sku ON public.size_specs(sku);

-- ④ PLM 카드 테이블 (기존 plm_cards에 컬럼 추가)
ALTER TABLE public.plm_cards
    ADD COLUMN IF NOT EXISTS sample_id uuid REFERENCES public.samples(id),
    ADD COLUMN IF NOT EXISTS size_spec_id uuid REFERENCES public.size_specs(id),
    ADD COLUMN IF NOT EXISTS season text,
    ADD COLUMN IF NOT EXISTS estimated_cost bigint DEFAULT 0,
    ADD COLUMN IF NOT EXISTS actual_cost bigint DEFAULT 0;
