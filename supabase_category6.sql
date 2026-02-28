-- Category 6: 자동화 실행 기록 테이블
CREATE TABLE IF NOT EXISTS public.automation_alerts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    job_name text NOT NULL,           -- '이지어드민 재고', '이지어드민 주문', '카페24'
    status text NOT NULL CHECK (status IN ('success', 'failure')),
    error_message text,               -- 실패 시 오류 내용
    is_read boolean DEFAULT false,    -- 관리자 확인 여부
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 최신 기록만 조회하면 되므로 created_at 인덱스
CREATE INDEX IF NOT EXISTS idx_automation_alerts_created ON public.automation_alerts(job_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_alerts_unread ON public.automation_alerts(is_read, status);
