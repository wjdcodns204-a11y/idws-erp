-- Category 3: CS 추적 테이블 생성
CREATE TABLE IF NOT EXISTS public.cs_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    platform text NOT NULL,           -- '무신사', '29CM', '카페24' 등
    order_number text,                -- 주문번호
    customer_name text,               -- 고객명
    request_type text NOT NULL CHECK (request_type IN ('반품', '교환')),
    reason text,                      -- 요청 사유
    status text DEFAULT '신규' CHECK (status IN ('신규', '처리중', '완료')),
    assignee text,                    -- 담당자명
    memo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone
);

-- 프리오더 이벤트 타입 지원: launch_calendar_events에 컬럼 추가
ALTER TABLE public.launch_calendar_events
ADD COLUMN IF NOT EXISTS event_type text DEFAULT '일반'
    CHECK (event_type IN ('일반', '프리오더', 'PLM'));

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_cs_requests_status ON public.cs_requests(status);
CREATE INDEX IF NOT EXISTS idx_calendar_preorder ON public.launch_calendar_events(event_date, event_type);
