-- 02 播种 50 个密码（CKAQ-2601 ~ CKAQ-2650），已存在则跳过
INSERT INTO public.test_passwords (code, active, used, max)
SELECT 'CKAQ-' || (2600 + i), true, 0, 3
FROM generate_series(1, 50) AS i
ON CONFLICT (code) DO NOTHING;
