-- Category 2 Phase 4~5 DB 추가

-- 플랫폼 수수료 설정 테이블
CREATE TABLE IF NOT EXISTS public.platform_fees (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    platform_name text UNIQUE NOT NULL,
    fee_pct numeric DEFAULT 0,
    color text DEFAULT '#6366f1',  -- 캘린더 색상
    updated_at timestamp with time zone DEFAULT now()
);

-- 기본 플랫폼 수수료 데이터 삽입
INSERT INTO public.platform_fees (platform_name, fee_pct, color) VALUES
    ('무신사', 30, '#3b82f6'),
    ('29CM', 35, '#10b981'),
    ('카페24', 5, '#8b5cf6'),
    ('기타', 0, '#94a3b8')
ON CONFLICT (platform_name) DO NOTHING;

-- 런칭 캘린더 이벤트 테이블
CREATE TABLE IF NOT EXISTS public.launch_calendar_events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    event_date date NOT NULL,
    platform text DEFAULT '기타',
    color text DEFAULT '#6366f1',
    memo text,
    plm_card_id uuid,
    is_auto boolean DEFAULT false,  -- PLM에서 자동 생성된 이벤트 여부
    created_at timestamp with time zone DEFAULT now()
);

-- 시스템 설정 테이블 (API 키 등)
CREATE TABLE IF NOT EXISTS public.system_settings (
    key text PRIMARY KEY,
    value text,
    description text,
    updated_at timestamp with time zone DEFAULT now()
);

-- 기본 설정값 삽입
INSERT INTO public.system_settings (key, value, description) VALUES
    ('ezadmin_api_key', '', '이지어드민 API 키 (재고/판매 데이터 자동 수집)'),
    ('ezadmin_shop_id', '', '이지어드민 쇼핑몰 ID')
ON CONFLICT (key) DO NOTHING;

-- 트리거 함수 (이미 존재하면 건너뜀)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_platform_fees_updated_at ON public.platform_fees;
CREATE TRIGGER trigger_platform_fees_updated_at
BEFORE UPDATE ON public.platform_fees
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
