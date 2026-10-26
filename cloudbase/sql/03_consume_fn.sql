-- 03 原子扣次函数（SECURITY DEFINER：绕过 RLS，只有这个函数能写）
CREATE OR REPLACE FUNCTION public.consume_use(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used int;
  v_max int;
  v_active bool;
BEGIN
  SELECT active, used, max INTO v_active, v_used, v_max
    FROM public.test_passwords
   WHERE code = upper(trim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'wrong');
  END IF;

  IF v_active = false THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'wrong');
  END IF;

  UPDATE public.test_passwords
     SET used = used + 1
   WHERE code = upper(trim(p_code)) AND used < max
  RETURNING used, max INTO v_used, v_max;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'exhausted', 'remain', 0);
  END IF;

  RETURN jsonb_build_object('valid', true, 'used', v_used, 'remain', v_max - v_used);
END;
$$;
