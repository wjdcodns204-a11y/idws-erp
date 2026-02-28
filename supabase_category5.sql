-- Category 5: 할 일(To-do) 테이블
CREATE TABLE IF NOT EXISTS public.todos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_email text NOT NULL,
    title text NOT NULL,
    priority text DEFAULT '일반' CHECK (priority IN ('긴급', '일반', '낮음')),
    due_date date,
    is_done boolean DEFAULT false,
    repeat_type text CHECK (repeat_type IN ('daily', 'weekly', 'monthly')),
    repeat_day int,  -- weekly: 요일(0=일~6=토), monthly: 날짜(1~31)
    created_at timestamp with time zone DEFAULT now()
);

-- Category 5: 사내 공지사항 테이블
CREATE TABLE IF NOT EXISTS public.notices (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    content text,
    importance text DEFAULT '일반' CHECK (importance IN ('긴급', '일반')),
    author_name text DEFAULT '정채운',
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_email ON public.todos(employee_email, is_done);
CREATE INDEX IF NOT EXISTS idx_notices_active ON public.notices(is_active, created_at DESC);
