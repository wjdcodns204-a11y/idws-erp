-- Category 1 Part 3 (HR Profiles & Appraisals) 기능을 위한 데이터베이스 스크립트

-- 1. employees 테이블 필드 추가 (연락처, 생일, 상태, 프로필 이미지 등)
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS phone_number text,
ADD COLUMN IF NOT EXISTS birth_date date,
ADD COLUMN IF NOT EXISTS profile_image_url text,
ADD COLUMN IF NOT EXISTS employee_status text DEFAULT 'active' NOT NULL CHECK (employee_status IN ('active', 'inactive', 'on_leave'));

-- *주의*: 급여, 계약서 파일 등의 민감 정보는 기존 employees와 분리된 확장 테이블(또는 동일 테이블 내 필드)로 관리 가능.
-- 여기서는 일단 심플하게 employees에 추가하되, 클라이언트에서 Role('master') 여부를 철저히 검사하여 통제합니다.
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS base_salary numeric,
ADD COLUMN IF NOT EXISTS contract_file_url text, -- Supabase Storage URL
ADD COLUMN IF NOT EXISTS contract_drive_link text; -- Google Drive URL

-- 2. 다면/성과 평가(Appraisal) 테이블 생성
CREATE TABLE IF NOT EXISTS public.performance_appraisals (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    evaluatee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL, -- 평가 대상자
    evaluator_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL, -- 평가자 (주로 master)
    period text NOT NULL, -- '2026-1H' (상반기), '2026-2H' 등
    score_achievement numeric(3,1) DEFAULT 0, -- 업무 달성도 (1~5점)
    score_communication numeric(3,1) DEFAULT 0, -- 커뮤니케이션 (1~5점)
    score_problem_solving numeric(3,1) DEFAULT 0, -- 문제 해결력 (1~5점)
    feedback_text text, -- 종합 의견
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- 트리거 함수 적용
DROP TRIGGER IF EXISTS trigger_appraisals_updated_at ON public.performance_appraisals;
CREATE TRIGGER trigger_appraisals_updated_at
BEFORE UPDATE ON public.performance_appraisals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
