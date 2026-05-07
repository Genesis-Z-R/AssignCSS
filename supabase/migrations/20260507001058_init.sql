-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create tables
CREATE TABLE public.courses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    year_group text NOT NULL
);

CREATE TABLE public.assignments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
    description text NOT NULL,
    due_date timestamptz NOT NULL,
    file_url text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.passwords (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name text NOT NULL UNIQUE,
    role text NOT NULL CHECK (role IN ('rep', 'admin')),
    password_hash text NOT NULL
);

-- RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passwords ENABLE ROW LEVEL SECURITY;

-- Policies for courses
CREATE POLICY "Public can view courses"
ON public.courses FOR SELECT TO public
USING (true);

CREATE POLICY "Admin can modify courses"
ON public.courses FOR ALL TO public
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
);

-- Policies for assignments
CREATE POLICY "Public can view assignments"
ON public.assignments FOR SELECT TO public
USING (true);

CREATE POLICY "Reps and admin can modify assignments"
ON public.assignments FOR ALL TO public
USING (
  current_setting('request.jwt.claims', true)::json->>'role' IN ('admin', 'rep')
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'role' IN ('admin', 'rep')
);

-- Policies for passwords
CREATE POLICY "Service role can access passwords"
ON public.passwords FOR ALL TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Admin can read passwords via custom JWT"
ON public.passwords FOR SELECT TO public
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
);

CREATE POLICY "Admin can insert passwords"
ON public.passwords FOR INSERT TO public
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
);

CREATE POLICY "Admin can update passwords"
ON public.passwords FOR UPDATE TO public
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
)
WITH CHECK (
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
);

CREATE POLICY "Admin can delete passwords"
ON public.passwords FOR DELETE TO public
USING (
  current_setting('request.jwt.claims', true)::json->>'role' = 'admin'
);


-- Insert initial admin password (password is 'admin123')
INSERT INTO public.passwords (class_name, role, password_hash)
VALUES ('master', 'admin', crypt('admin123', gen_salt('bf')));

-- Storage Bucket (requires storage.buckets and storage.objects which are created by supabase auth)
INSERT INTO storage.buckets (id, name, public) VALUES ('assignment-attachments', 'assignment-attachments', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Public can read assignment-attachments"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'assignment-attachments');

CREATE POLICY "Reps and admin can modify assignment-attachments"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'assignment-attachments' AND
  current_setting('request.jwt.claims', true)::json->>'role' IN ('admin', 'rep')
);

CREATE POLICY "Reps and admin can update assignment-attachments"
ON storage.objects FOR UPDATE TO public
USING (
  bucket_id = 'assignment-attachments' AND
  current_setting('request.jwt.claims', true)::json->>'role' IN ('admin', 'rep')
)
WITH CHECK (
  bucket_id = 'assignment-attachments' AND
  current_setting('request.jwt.claims', true)::json->>'role' IN ('admin', 'rep')
);

CREATE POLICY "Reps and admin can delete assignment-attachments"
ON storage.objects FOR DELETE TO public
USING (
  bucket_id = 'assignment-attachments' AND
  current_setting('request.jwt.claims', true)::json->>'role' IN ('admin', 'rep')
);

-- RPC to verify password
CREATE OR REPLACE FUNCTION public.verify_password(input_password text)
RETURNS TABLE (user_id uuid, user_class_name text, user_role text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.class_name, p.role
  FROM public.passwords p
  WHERE p.password_hash = crypt(input_password, p.password_hash);
END;
$$;
