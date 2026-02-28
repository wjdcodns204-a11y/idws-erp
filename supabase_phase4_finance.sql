-- Phase 4: 재무·손익 관리
-- ⚠️ Supabase SQL Editor에서 실행해주세요

-- ① 매출 기록 테이블 (플랫폼별 월 매출 직접 입력)
CREATE TABLE IF NOT EXISTS public.revenue_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    year_month text NOT NULL,                    -- '2026-02' 형식
    platform text NOT NULL,                      -- '무신사', '29CM' 등
    gross_sales bigint DEFAULT 0,                -- 총 매출(원)
    returns_amount bigint DEFAULT 0,             -- 반품/환불 금액
    platform_fee_pct numeric(5,2) DEFAULT 0,     -- 수수료율 (%)
    net_sales bigint GENERATED ALWAYS AS (gross_sales - returns_amount) STORED,  -- 순매출
    platform_fee bigint GENERATED ALWAYS AS (ROUND((gross_sales - returns_amount) * platform_fee_pct / 100)) STORED,
    memo text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(year_month, platform)
);

-- ② 비용 기록 테이블 (월별 각종 비용)
CREATE TABLE IF NOT EXISTS public.expense_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    year_month text NOT NULL,                    -- '2026-02'
    category text NOT NULL CHECK (category IN (
        '매입원가', '인건비', '광고비', '물류비', '임대료', '기타운영비', '카드수수료'
    )),
    amount bigint NOT NULL DEFAULT 0,            -- 비용 금액(원)
    description text,                            -- 상세 내용
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expense_yearmonth ON public.expense_records(year_month);

-- ③ 광고비 상세 테이블
CREATE TABLE IF NOT EXISTS public.ad_expenses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    year_month text NOT NULL,
    platform text NOT NULL,                      -- '무신사 광고', 'META', '구글', '카카오'
    campaign_name text,
    budget bigint DEFAULT 0,                     -- 예산
    actual_spend bigint DEFAULT 0,               -- 실제 지출
    impressions bigint DEFAULT 0,                -- 노출 수
    clicks int DEFAULT 0,                        -- 클릭 수
    orders int DEFAULT 0,                        -- 전환 주문 수
    memo text,
    created_at timestamp with time zone DEFAULT now()
);

-- ④ 예산 계획 테이블
CREATE TABLE IF NOT EXISTS public.budget_plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    year_month text NOT NULL,
    category text NOT NULL,
    budgeted_amount bigint NOT NULL DEFAULT 0,   -- 계획 금액
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(year_month, category)
);

-- ⑤ 세금계산서 테이블
CREATE TABLE IF NOT EXISTS public.tax_invoices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    type text NOT NULL CHECK (type IN ('발행', '수령')),  -- 발행: 매출, 수령: 매입
    invoice_date date NOT NULL,
    company_name text NOT NULL,                  -- 거래처명
    business_number text,                        -- 사업자등록번호
    amount bigint NOT NULL DEFAULT 0,            -- 공급가액
    vat bigint GENERATED ALWAYS AS (ROUND(amount * 0.1)) STORED,  -- 부가세 (10%)
    total_amount bigint GENERATED ALWAYS AS (ROUND(amount * 1.1)) STORED,
    item_description text,                       -- 품목
    status text DEFAULT '정상' CHECK (status IN ('정상', '수정', '취소')),
    memo text,
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_invoice_date ON public.tax_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_tax_invoice_type ON public.tax_invoices(type);
