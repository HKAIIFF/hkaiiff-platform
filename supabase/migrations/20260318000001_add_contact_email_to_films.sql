-- 新增 contact_email 字段：用于奖金发放与版权文件签署的官方联系邮箱
-- 🔒 极密保护：此字段仅限 Admin 服务端查询，严禁暴露于任何公共视图或前端接口

ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- 安全注释：若项目后续建立 films_public_view，必须明确排除 contact_email
-- CREATE VIEW public.films_public_view AS
--   SELECT id, title, studio, tech_stack, ai_ratio, synopsis, poster_url,
--          trailer_url, feature_url, status, created_at
--     FROM public.films
--    WHERE is_feed_published = TRUE;
-- （contact_email 不在上述视图列中，确保隐私隔离）

COMMENT ON COLUMN public.films.contact_email IS
  '官方联系邮箱：用于入围通知、奖金结算、版权协议签署。极密字段，仅限 Admin 权限查询，严禁出现在任何公共接口响应中。';
