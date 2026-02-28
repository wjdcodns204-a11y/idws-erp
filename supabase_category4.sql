-- Category 4: 매출 목표 테이블
CREATE TABLE IF NOT EXISTS public.sales_goals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    year int NOT NULL,
    platform text DEFAULT '전체',  -- '전체', '무신사', '29CM' 등
    goal_amount bigint NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(year, platform)
);

-- 기본 2026년 목표 데이터 삽입
INSERT INTO public.sales_goals (year, platform, goal_amount) VALUES
    (2026, '전체', 500000000),
    (2026, '무신사', 300000000),
    (2026, '29CM', 150000000),
    (2026, '카페24', 50000000)
ON CONFLICT (year, platform) DO NOTHING;
