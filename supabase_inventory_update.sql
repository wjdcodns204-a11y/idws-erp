-- Category 2 DB 업데이트
-- inventory_change_logs 테이블 생성
CREATE TABLE IF NOT EXISTS public.inventory_change_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sku text NOT NULL,
    product_name text,
    reason text NOT NULL CHECK (reason IN (
        '판매출고', '반품입고', '불량처리', '샘플사용', 
        '재고조사보정', '촬영용출고', '기타'
    )),
    quantity_delta integer NOT NULL, -- 양수: 입고, 음수: 출고
    warehouse text DEFAULT '이지어드민 창고',
    memo text,
    created_by text, -- 기록한 직원명
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- PLM 신상품 칸반 카드 테이블 생성
CREATE TABLE IF NOT EXISTS public.plm_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    stage text NOT NULL DEFAULT '기획' CHECK (stage IN (
        '기획', '디자인', '1차 투입', '2차 투입', 
        '생산의뢰', '부자재 발주', '입고'
    )),
    assignee text,
    target_date date,
    memo text,
    style_code text,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- products 테이블 상태 필드 추가 (판매중지 관리)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS display_status text DEFAULT 'active' 
    CHECK (display_status IN ('active', 'discontinued')),
ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS platform_fee_pct numeric DEFAULT 0;

-- 트리거 생성
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_plm_cards_updated_at ON public.plm_cards;
CREATE TRIGGER trigger_plm_cards_updated_at
BEFORE UPDATE ON public.plm_cards
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
