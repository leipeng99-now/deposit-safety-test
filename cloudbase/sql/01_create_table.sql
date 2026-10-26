-- 01 建表
CREATE TABLE IF NOT EXISTS public.test_passwords (
  code text PRIMARY KEY,
  active boolean NOT NULL DEFAULT true,
  used integer NOT NULL DEFAULT 0,
  max integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);
