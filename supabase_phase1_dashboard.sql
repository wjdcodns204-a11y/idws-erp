-- Phase 1: 대시보드 KPI 설정 테이블
-- Supabase SQL Editor에서 실행해주세요

CREATE TABLE IF NOT EXISTS public.dashboard_kpi (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    monthly_goal bigint DEFAULT 210000000,      -- 월 매출 목표
    low_stock_threshold int DEFAULT 20,          -- 재고 부족 기준 수량
    updated_at timestamp with time zone DEFAULT now()
);

-- 기본값 삽입
INSERT INTO public.dashboard_kpi (monthly_goal, low_stock_threshold)
VALUES (210000000, 20)
ON CONFLICT DO NOTHING;
