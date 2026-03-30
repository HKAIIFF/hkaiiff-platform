-- ============================================================
-- AIF 餘額 RPC（sync-balance / Helius webhook / 支付扣款）
-- 先前僅在應用層調用，若數據庫未部署則 PostgREST 報 schema cache 找不到函數
-- ============================================================

DROP FUNCTION IF EXISTS public.increment_aif_balance(numeric, text, text);
DROP FUNCTION IF EXISTS public.increment_aif_balance(numeric, text);
DROP FUNCTION IF EXISTS public.increment_aif_balance(text, numeric);

CREATE OR REPLACE FUNCTION public.increment_aif_balance(
  amount_to_add numeric,
  wallet_addr text DEFAULT NULL,
  user_id_param text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid         text;
  rows_updated int;
BEGIN
  IF amount_to_add IS NULL OR amount_to_add <= 0 THEN
    RAISE EXCEPTION 'increment_aif_balance: invalid amount';
  END IF;

  IF user_id_param IS NOT NULL AND length(trim(user_id_param)) > 0 THEN
    uid := trim(user_id_param);
  ELSIF wallet_addr IS NOT NULL AND length(trim(wallet_addr)) > 0 THEN
    SELECT u.id INTO uid
    FROM public.users u
    WHERE u.deposit_address = trim(wallet_addr)
    LIMIT 1;
    IF uid IS NULL THEN
      RAISE EXCEPTION 'increment_aif_balance: unknown deposit_address';
    END IF;
  ELSE
    RAISE EXCEPTION 'increment_aif_balance: need user_id_param or wallet_addr';
  END IF;

  UPDATE public.users
  SET aif_balance = COALESCE(aif_balance, 0) + amount_to_add
  WHERE id = uid;
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  IF rows_updated <> 1 THEN
    RAISE EXCEPTION 'increment_aif_balance: user not found for id %', uid;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_aif_balance(numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_aif_balance(numeric, text, text) TO service_role;

-- ------------------------------------------------------------
-- 原子扣款（與應用層 p_user_id / p_amount 參數名一致）
-- ------------------------------------------------------------

DROP FUNCTION IF EXISTS public.deduct_aif_balance(text, numeric);

CREATE OR REPLACE FUNCTION public.deduct_aif_balance(
  p_user_id text,
  p_amount numeric
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.users
  SET aif_balance = COALESCE(aif_balance, 0) - p_amount
  WHERE id = p_user_id
    AND COALESCE(aif_balance, 0) >= p_amount;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_aif_balance(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deduct_aif_balance(text, numeric) TO service_role;

-- ============================================================
-- 消息可見性：運營/內部告警不得出現在用戶收件箱
-- user_id IS NULL 的廣播默認仍為用戶可見；audience = admin_only 僅管理端可查
-- ============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'users'
  CHECK (audience IN ('users', 'admin_only'));

-- 將已誤入庫的內部告警標記為僅管理端可見（標題特徵匹配）
UPDATE public.messages
SET audience = 'admin_only'
WHERE user_id IS NULL
  AND audience = 'users'
  AND (
    title LIKE '%Sweep 成功但記帳失敗%'
    OR title LIKE '%墊付錢包%'
    OR title LIKE '%SOL 餘額緊急%'
    OR title LIKE '%CRITICAL%'
  );

CREATE INDEX IF NOT EXISTS idx_messages_audience_user_id
  ON public.messages (audience, user_id)
  WHERE deleted_at IS NULL;
