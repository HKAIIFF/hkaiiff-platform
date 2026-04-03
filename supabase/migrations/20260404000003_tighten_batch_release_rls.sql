-- P2: 收緊批片相關表的公開 SELECT（anon key 不再能讀 batch 條目）

DROP POLICY IF EXISTS "batch_release_items: select all" ON public.batch_release_items;
DROP POLICY IF EXISTS "batch_releases: select all" ON public.batch_releases;
