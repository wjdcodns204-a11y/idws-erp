-- Phase 5: HR 강화 — 급여, 4대보험, 연차, 면담
-- ⚠️ Supabase SQL Editor에서 실행해주세요

-- ① 급여 기록 테이블
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    year_month text NOT NULL,                    -- '2026-02'
    base_salary bigint NOT NULL DEFAULT 0,       -- 기본급
    performance_bonus bigint DEFAULT 0,          -- 성과급
    overtime_pay bigint DEFAULT 0,               -- 시간외 수당
    meal_allowance bigint DEFAULT 30000,         -- 식대 (비과세)
    transport_allowance bigint DEFAULT 0,        -- 교통비
    gross_pay bigint GENERATED ALWAYS AS (
        base_salary + performance_bonus + overtime_pay + meal_allowance + transport_allowance
    ) STORED,
    -- 4대보험 공제 (직원 부담분 2026년 기준)
    national_pension bigint GENERATED ALWAYS AS (ROUND(base_salary * 0.045)) STORED,    -- 국민연금 4.5%
    health_insurance bigint GENERATED ALWAYS AS (ROUND(base_salary * 0.03545)) STORED,  -- 건강보험 3.545%
    long_term_care bigint GENERATED ALWAYS AS (ROUND(base_salary * 0.03545 * 0.1295)) STORED, -- 장기요양 12.95%
    employment_insurance bigint GENERATED ALWAYS AS (ROUND(base_salary * 0.009)) STORED, -- 고용보험 0.9%
    income_tax bigint DEFAULT 0,                 -- 소득세 (수동 입력 또는 계산)
    local_income_tax bigint GENERATED ALWAYS AS (ROUND(income_tax * 0.1)) STORED,       -- 지방소득세 10%
    net_pay bigint GENERATED ALWAYS AS (
        base_salary + performance_bonus + overtime_pay + meal_allowance + transport_allowance
        - ROUND(base_salary * 0.045)
        - ROUND(base_salary * 0.03545)
        - ROUND(base_salary * 0.03545 * 0.1295)
        - ROUND(base_salary * 0.009)
        - income_tax
        - ROUND(income_tax * 0.1)
    ) STORED,
    memo text,
    paid_at date,                                -- 실제 지급일
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, year_month)
);
CREATE INDEX IF NOT EXISTS idx_payroll_yearmonth ON public.payroll_records(year_month);
CREATE INDEX IF NOT EXISTS idx_payroll_employee ON public.payroll_records(employee_id);

-- ② 연차 기록 테이블 (연도별 잔여 연차 관리)
CREATE TABLE IF NOT EXISTS public.annual_leave_balance (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    year int NOT NULL,                           -- 해당 연도
    total_days numeric(4,1) NOT NULL DEFAULT 15, -- 발생 연차
    used_days numeric(4,1) DEFAULT 0,            -- 사용 연차
    remaining_days numeric(4,1) GENERATED ALWAYS AS (total_days - used_days) STORED,
    carry_over_days numeric(4,1) DEFAULT 0,      -- 이월 연차
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(employee_id, year)
);

-- ③ 면담 기록 테이블
CREATE TABLE IF NOT EXISTS public.interview_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    interviewer_id uuid REFERENCES public.employees(id),  -- 면담자(상사)
    interview_date date NOT NULL,
    type text DEFAULT '정기면담' CHECK (type IN ('정기면담', '성과면담', '개선면담', '퇴직면담', '기타')),
    content text,                                -- 면담 내용
    action_items text,                           -- 후속 조치
    next_date date,                              -- 다음 면담 예정일
    is_confidential boolean DEFAULT true,        -- 비밀 여부
    created_at timestamp with time zone DEFAULT now()
);

-- ④ 직원 교육 이력 테이블
CREATE TABLE IF NOT EXISTS public.training_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    training_name text NOT NULL,                 -- 교육명
    category text DEFAULT '사내교육' CHECK (category IN ('사내교육', '외부교육', '온라인교육', '자격증')),
    training_date date,
    duration_hours numeric(5,1) DEFAULT 0,       -- 교육 시간
    institution text,                            -- 교육 기관
    result text,                                 -- 이수/합격 여부
    certificate_url text,                        -- 자격증 파일 URL
    created_at timestamp with time zone DEFAULT now()
);

-- ⑤ 퇴직 정보 테이블
CREATE TABLE IF NOT EXISTS public.resignation_records (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
    resign_date date NOT NULL,                   -- 퇴직일
    reason text,                                 -- 퇴직 사유
    severance_pay bigint DEFAULT 0,              -- 퇴직금
    handover_status text DEFAULT '미완료' CHECK (handover_status IN ('미완료', '진행중', '완료')),
    handover_memo text,                          -- 인수인계 내용
    created_at timestamp with time zone DEFAULT now()
);
