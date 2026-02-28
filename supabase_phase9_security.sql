-- Phase 9: 보안·권한 관리
-- ⚠️ Supabase SQL Editor에서 실행해주세요

-- ① 역할별 메뉴 권한 테이블
-- role: 'admin'(대표), 'leader'(팀장), 'staff'(사원)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    role text NOT NULL CHECK (role IN ('admin', 'leader', 'staff')),
    menu_key text NOT NULL,            -- 메뉴 식별자 (예: 'finance', 'hr_payroll')
    can_view boolean DEFAULT true,     -- 조회 권한
    can_create boolean DEFAULT false,  -- 생성 권한
    can_edit boolean DEFAULT false,    -- 수정 권한
    can_delete boolean DEFAULT false,  -- 삭제 권한
    UNIQUE(role, menu_key)
);

-- 기본 권한 설정 (admin = 전체, leader = 조회+생성+수정, staff = 조회만)
INSERT INTO public.role_permissions (role, menu_key, can_view, can_create, can_edit, can_delete) VALUES
-- admin 전체 권한
('admin', 'dashboard', true, true, true, true),
('admin', 'inventory', true, true, true, true),
('admin', 'orders', true, true, true, true),
('admin', 'finance', true, true, true, true),
('admin', 'hr', true, true, true, true),
('admin', 'hr_payroll', true, true, true, true),
('admin', 'plm', true, true, true, true),
('admin', 'analytics', true, true, true, true),
('admin', 'settings', true, true, true, true),
('admin', 'purchase_orders', true, true, true, true),
-- leader 권한
('leader', 'dashboard', true, false, false, false),
('leader', 'inventory', true, true, true, false),
('leader', 'orders', true, true, true, false),
('leader', 'finance', true, false, false, false),
('leader', 'hr', true, true, true, false),
('leader', 'hr_payroll', false, false, false, false),
('leader', 'plm', true, true, true, false),
('leader', 'analytics', true, false, false, false),
('leader', 'settings', false, false, false, false),
('leader', 'purchase_orders', true, true, true, false),
-- staff 권한
('staff', 'dashboard', true, false, false, false),
('staff', 'inventory', true, false, false, false),
('staff', 'orders', true, true, false, false),
('staff', 'finance', false, false, false, false),
('staff', 'hr', true, false, false, false),
('staff', 'hr_payroll', false, false, false, false),
('staff', 'plm', true, true, false, false),
('staff', 'analytics', false, false, false, false),
('staff', 'settings', false, false, false, false),
('staff', 'purchase_orders', true, false, false, false)
ON CONFLICT (role, menu_key) DO NOTHING;

-- ② 활동 로그 테이블 (감사 로그)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email text NOT NULL,
    user_name text,
    action text NOT NULL,              -- 'create', 'update', 'delete', 'view', 'login', 'logout'
    resource text NOT NULL,            -- 'order', 'employee', 'payroll' 등
    resource_id text,                  -- 대상 레코드 ID
    description text,                  -- 사람이 읽기 쉬운 설명
    ip_address text,
    user_agent text,
    metadata jsonb,                    -- 추가 데이터 (변경 전후 값 등)
    created_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_email ON public.activity_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON public.activity_logs(resource);

-- ③ 로그인 실패 기록 테이블
CREATE TABLE IF NOT EXISTS public.login_attempts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    email text NOT NULL,
    ip_address text,
    success boolean DEFAULT false,
    attempted_at timestamp with time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON public.login_attempts(email);
