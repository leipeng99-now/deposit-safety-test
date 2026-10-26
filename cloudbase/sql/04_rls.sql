-- 04 安全策略：anon 只能读密码表（不含敏感信息），只能通过 consume_use 扣次
ALTER TABLE public.test_passwords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_passwords ON public.test_passwords;
CREATE POLICY anon_read_passwords ON public.test_passwords
  FOR SELECT TO anon USING (true);

GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.test_passwords TO anon;
GRANT EXECUTE ON FUNCTION public.consume_use(text) TO anon;
