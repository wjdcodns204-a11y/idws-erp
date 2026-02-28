-- Category 1 (HR & Culture) 기능을 위한 데이터베이스 업데이트 스크립트

-- 1. employees 테이블 확장 (권한, 입사일, 연차 통계)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' NOT NULL,
ADD COLUMN IF NOT EXISTS hire_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS annual_leave_total numeric(4,1) DEFAULT 0,
ADD COLUMN IF NOT EXISTS annual_leave_used numeric(4,1) DEFAULT 0;

-- 기존 특정 사용자를 master로 임의 권한 업데이트 (정채운 대표, 이주영 님 추정 이메일/이름 매핑 필요)
-- 향후 앱 내 또는 Supabase 대시보드에서 직접 'master'로 변경 필요.
-- UPDATE public.employees SET role = 'master' WHERE name IN ('정채운', '이주영');

-- 2. 휴가 결재 시스템 테이블 생성 (leave_requests)
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    type text NOT NULL CHECK (type IN ('연차', '반차', '병가', '경조사', '공가', '기타')),
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- RLS 활성화를 대비한 간단한 주석
-- ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- 3. 온라인 업무 일지 테이블 생성 (daily_work_logs)
CREATE TABLE IF NOT EXISTS public.daily_work_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    log_date date NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(employee_id, log_date) -- 하루에 하나의 일지만 작성하도록 제한
);

-- 4. 업무 일지 댓글(피드백) 테이블 생성 (work_log_comments)
CREATE TABLE IF NOT EXISTS public.work_log_comments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    work_log_id uuid REFERENCES public.daily_work_logs(id) ON DELETE CASCADE NOT NULL,
    author_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 트리거용 updated_at 함수 (기존에 없다면 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_leave_requests_updated_at ON public.leave_requests;
CREATE TRIGGER trigger_leave_requests_updated_at
BEFORE UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_daily_work_logs_updated_at ON public.daily_work_logs;
CREATE TRIGGER trigger_daily_work_logs_updated_at
BEFORE UPDATE ON public.daily_work_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
