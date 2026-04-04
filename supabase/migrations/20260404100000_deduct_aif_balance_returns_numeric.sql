-- deduct_aif_balance：改為返回扣款後餘額（NUMERIC），餘額不足或用戶不存在時拋錯。
-- 與舊版 RETURNS boolean 相比，應用層可直接取得 new_balance；仍保留 WHERE 原子守衛。

DROP FUNCTION IF EXISTS public.deduct_aif_balance(text, numeric);

CREATE OR REPLACE FUNCTION public.deduct_aif_balance(
  p_user_id text,
  p_amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance numeric;
  updated_count int;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'deduct_aif_balance: invalid amount';
  END IF;

  UPDATE public.users
  SET aif_balance = COALESCE(aif_balance, 0) - p_amount
  WHERE id = p_user_id
    AND COALESCE(aif_balance, 0) >= p_amount
  RETURNING aif_balance INTO v_new_balance;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'Insufficient balance or user not found';
  END IF;

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_aif_balance(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_aif_balance(text, numeric) TO service_role;
