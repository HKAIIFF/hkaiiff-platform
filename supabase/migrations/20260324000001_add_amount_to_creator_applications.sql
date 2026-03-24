-- 为 creator_applications 表添加 amount 字段
-- 记录身份认证实际收费金额（AIF=150，USD=30）
-- 注：此字段已通过 Supabase Dashboard 直接添加，此迁移文件仅作版本记录

ALTER TABLE public.creator_applications
ADD COLUMN IF NOT EXISTS amount NUMERIC;

COMMENT ON COLUMN public.creator_applications.amount
IS '身份认证收费金额：AIF支付=150，法币支付=30';
