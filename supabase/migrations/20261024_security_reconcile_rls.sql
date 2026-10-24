-- ============================================================================
-- 資料庫權限對齊（可重複執行）
--
-- 目的
--   1. 把資料庫權限收斂到 repo 預期的狀態（後台專用表僅 service_role 可存取、
--      管理員判斷只認 profiles.is_admin、UPDATE policy 不得竄改作者等）。
--   2. 修正與權限相關的功能問題：文章／留言計數在 RLS 下靜默不更新、私訊 policy
--      遞迴導致查詢失敗、通知型別 CHECK 缺值導致私訊與社團邀請寫入失敗、
--      車友會成員管理 policy 的作用範圍錯誤。
--
-- 與既有 migration 的關係
--   本檔取代 20260316_rls_hardening / 20260316_rls_policy_adjustments /
--   20260316_rls_review_fixes 三份。無論那三份「已套用」「部分套用」或「完全未套用」，
--   本檔都能安全重跑。若尚未套用那三份，請改套用本檔，不要再執行它們：
--   舊檔不可重複執行，且舊檔會讓文章計數靜默停止更新，本檔已一併處理。
--
-- 設計
--   每個步驟獨立執行；單一步驟失敗只會記錄，不會讓其他步驟回滾。
--   最後一個查詢會列出每一步的結果與驗證項目，失敗列排在最前面。
--
-- 套用方式
--   Supabase Dashboard > SQL Editor 貼上整份執行，檢視最後一個結果表。
--   若結果表出現 ok = false 的列，請依 detail 欄位處理後再執行一次（可重複執行）。
-- ============================================================================

CREATE TEMP TABLE IF NOT EXISTS _hardening_log (step text, ok boolean, detail text);
TRUNCATE _hardening_log;

-- ----------------------------------------------------------------------------
-- 暫時性輔助函式（只存在於本次連線）
-- ----------------------------------------------------------------------------

-- 執行一個步驟；p_needs 為前置條件：資料表名稱，或 'fn:簽章'（函式）。
-- 前置條件不存在時略過，不視為失敗。
CREATE OR REPLACE FUNCTION pg_temp._apply(p_step text, p_needs text, p_sql text)
RETURNS void LANGUAGE plpgsql AS $fn$
BEGIN
  IF p_needs IS NOT NULL THEN
    IF (p_needs LIKE 'fn:%' AND to_regprocedure(substr(p_needs, 4)) IS NULL)
       OR (p_needs NOT LIKE 'fn:%' AND to_regclass('public.' || p_needs) IS NULL) THEN
      INSERT INTO _hardening_log VALUES (p_step, true, 'skipped: ' || p_needs || ' not present');
      RETURN;
    END IF;
  END IF;
  EXECUTE p_sql;
  INSERT INTO _hardening_log VALUES (p_step, true, NULL);
EXCEPTION WHEN OTHERS THEN
  INSERT INTO _hardening_log VALUES (p_step, false, SQLERRM);
END
$fn$;

-- 刪除某張表的 policy（可限定指令類型）
CREATE OR REPLACE FUNCTION pg_temp._drop_policies(p_table text, p_cmd text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table
      AND (p_cmd IS NULL OR cmd = p_cmd)
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, p_table);
  END LOOP;
END
$fn$;

-- 擴充既有的 CHECK（保留原本允許的值，再加上 p_extra）；找不到 CHECK 時不做事。
CREATE OR REPLACE FUNCTION pg_temp._extend_check(p_table text, p_col text, p_extra text[], p_name text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  c record;
  m text[];
  vals text[] := '{}';
BEGIN
  FOR c IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = format('public.%I', p_table)::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ~ ('\m' || p_col || '\M')
  LOOP
    FOR m IN SELECT regexp_matches(c.def, '''([^'']+)''::text', 'g') LOOP
      vals := vals || m[1];
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', p_table, c.conname);
  END LOOP;
  IF array_length(vals, 1) IS NULL THEN
    RAISE NOTICE 'no CHECK on %.% found, nothing to extend', p_table, p_col;
    RETURN;
  END IF;
  SELECT array_agg(DISTINCT v) INTO vals FROM unnest(vals || p_extra) AS v;
  EXECUTE format(
    'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%I = ANY (%L::text[]))',
    p_table, p_name, p_col, vals
  );
END
$fn$;

-- ============================================================================
-- 1. 計數函式改為 SECURITY DEFINER
--    這些 trigger 函式原本以呼叫者身分更新 generated_articles / comments。
--    一旦目標表啟用 RLS 且沒有對應的 UPDATE policy，更新會被靜默略過（0 列、不報錯），
--    造成按讚、留言、收藏、分享、瀏覽數都不再增加。
-- ============================================================================
SELECT pg_temp._apply('counter fn: update_article_comments_count', 'fn:public.update_article_comments_count()',
  $q$ ALTER FUNCTION public.update_article_comments_count() SECURITY DEFINER SET search_path = public, pg_temp $q$);
SELECT pg_temp._apply('counter fn: update_article_favorites_count', 'fn:public.update_article_favorites_count()',
  $q$ ALTER FUNCTION public.update_article_favorites_count() SECURITY DEFINER SET search_path = public, pg_temp $q$);
SELECT pg_temp._apply('counter fn: update_article_likes_count', 'fn:public.update_article_likes_count()',
  $q$ ALTER FUNCTION public.update_article_likes_count() SECURITY DEFINER SET search_path = public, pg_temp $q$);
SELECT pg_temp._apply('counter fn: update_article_share_count', 'fn:public.update_article_share_count()',
  $q$ ALTER FUNCTION public.update_article_share_count() SECURITY DEFINER SET search_path = public, pg_temp $q$);
SELECT pg_temp._apply('counter fn: increment_share_count', 'fn:public.increment_share_count()',
  $q$ ALTER FUNCTION public.increment_share_count() SECURITY DEFINER SET search_path = public, pg_temp $q$);
SELECT pg_temp._apply('counter fn: update_comment_likes_count', 'fn:public.update_comment_likes_count()',
  $q$ ALTER FUNCTION public.update_comment_likes_count() SECURITY DEFINER SET search_path = public, pg_temp $q$);
SELECT pg_temp._apply('counter fn: increment_view_count(text)', 'fn:public.increment_view_count(text)',
  $q$ ALTER FUNCTION public.increment_view_count(text) SECURITY DEFINER SET search_path = public, pg_temp $q$);
SELECT pg_temp._apply('counter fn: increment_view_count(uuid) search_path', 'fn:public.increment_view_count(uuid)',
  $q$ ALTER FUNCTION public.increment_view_count(uuid) SET search_path = public, pg_temp $q$);

-- ============================================================================
-- 2. 後台專用資料表：僅 service_role 可存取
--    刪除該表既有的所有 policy（含歷史遺留的寬鬆 policy），再建立 service_role 專用 policy，
--    並移除 anon / authenticated 的資料表權限作為第二層防線。
-- ============================================================================
SELECT pg_temp._apply('service-only: ' || t, t, format($q$
  ALTER TABLE public.%1$I ENABLE ROW LEVEL SECURITY;
  SELECT pg_temp._drop_policies(%1$L);
  CREATE POLICY %2$I ON public.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true);
  REVOKE ALL ON public.%1$I FROM anon, authenticated;
$q$, t, 'Only service role can access ' || t))
FROM unnest(ARRAY[
  'raw_articles', 'article_clusters', 'daily_topic_locks', 'cron_logs', 'style_configs',
  'image_experiments', 'image_experiment_samples', 'generator_state',
  'meta_credentials', 'social_posts',
  'share_events', 'image_audit', 'ai_usage_logs'
]) AS t;

-- ============================================================================
-- 3. generated_articles：公開可讀，寫入僅 service_role
-- ============================================================================
SELECT pg_temp._apply('generated_articles: RLS + policies', 'generated_articles', $q$
  ALTER TABLE public.generated_articles ENABLE ROW LEVEL SECURITY;
  SELECT pg_temp._drop_policies('generated_articles');
  CREATE POLICY "Articles are publicly readable" ON public.generated_articles
    FOR SELECT USING (true);
  CREATE POLICY "Only service role can modify articles" ON public.generated_articles
    FOR INSERT TO service_role WITH CHECK (true);
  CREATE POLICY "Only service role can update articles" ON public.generated_articles
    FOR UPDATE TO service_role USING (true) WITH CHECK (true);
  CREATE POLICY "Only service role can delete articles" ON public.generated_articles
    FOR DELETE TO service_role USING (true);
  REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.generated_articles FROM anon, authenticated;
$q$);

-- ============================================================================
-- 4. 通知型別 CHECK：補上 club_invitation 與 direct_message
--    保留原本已允許的值，避免誤擋既有資料。
-- ============================================================================
SELECT pg_temp._apply('notifications.type CHECK', 'notifications', $q$
  SELECT pg_temp._extend_check('notifications', 'type',
    ARRAY['comment_reply','comment_like','new_follower','followed_comment','forum_reply',
          'car_club_post','system','club_invitation','direct_message'],
    'notifications_type_check')
$q$);

-- ============================================================================
-- 5. 私訊：以 SECURITY DEFINER 函式判斷參與者，移除 policy 自我參照造成的遞迴
-- ============================================================================
SELECT pg_temp._apply('dm: is_conversation_participant()', 'conversation_participants', $q$
  CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $f$
    SELECT EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
    )
  $f$;
  REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid) TO anon, authenticated, service_role;
$q$);

SELECT pg_temp._apply('dm: conversations policies', 'conversations', $q$
  SELECT pg_temp._drop_policies('conversations', 'SELECT');
  CREATE POLICY "Participants can view conversations" ON public.conversations
    FOR SELECT USING (public.is_conversation_participant(id));
$q$);

SELECT pg_temp._apply('dm: conversation_participants policies', 'conversation_participants', $q$
  SELECT pg_temp._drop_policies('conversation_participants', 'SELECT');
  CREATE POLICY "Participants can view conversation_participants" ON public.conversation_participants
    FOR SELECT USING (public.is_conversation_participant(conversation_id));
$q$);

SELECT pg_temp._apply('dm: messages policies', 'messages', $q$
  SELECT pg_temp._drop_policies('messages', 'SELECT');
  SELECT pg_temp._drop_policies('messages', 'INSERT');
  CREATE POLICY "Participants can view messages" ON public.messages
    FOR SELECT USING (public.is_conversation_participant(conversation_id));
  CREATE POLICY "Participants can send messages" ON public.messages
    FOR INSERT WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id));
$q$);

-- ============================================================================
-- 6. 車友會成員：加入、管理、離開
--    - 加入時只能以 member / active 身分加入公開且非私人的車友會；
--      車友會創辦人可登記自己為 owner（建立車友會時使用）。
--    - 管理權限只在「同一個」車友會內生效，且不能修改 owner；
--      只有 owner 能設定或修改 admin。
--    - 被封鎖（banned）的成員不能自行退出再重新加入；owner 不能直接刪除自己的紀錄。
-- ============================================================================
SELECT pg_temp._apply('clubs: helper functions', 'car_club_members', $q$
  CREATE OR REPLACE FUNCTION public.is_club_owner(p_club_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $f$
    SELECT EXISTS (SELECT 1 FROM public.car_clubs WHERE id = p_club_id AND owner_id = auth.uid())
  $f$;
  CREATE OR REPLACE FUNCTION public.is_club_manager(p_club_id uuid)
  RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $f$
    SELECT public.is_club_owner(p_club_id) OR EXISTS (
      SELECT 1 FROM public.car_club_members
      WHERE club_id = p_club_id AND user_id = auth.uid()
        AND role IN ('owner', 'admin') AND status = 'active'
    )
  $f$;
  REVOKE ALL ON FUNCTION public.is_club_owner(uuid), public.is_club_manager(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.is_club_owner(uuid), public.is_club_manager(uuid)
    TO anon, authenticated, service_role;
$q$);

SELECT pg_temp._apply('clubs: status CHECK allows kicked', 'car_club_members', $q$
  SELECT pg_temp._extend_check('car_club_members', 'status',
    ARRAY['pending','active','banned','kicked'], 'car_club_members_status_check')
$q$);

SELECT pg_temp._apply('clubs: member INSERT policy', 'car_club_members', $q$
  DO $do$
  DECLARE
    priv text := '';
  BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'car_clubs' AND column_name = 'is_private') THEN
      priv := ' AND COALESCE(c.is_private, false) = false';
    END IF;
    PERFORM pg_temp._drop_policies('car_club_members', 'INSERT');
    EXECUTE format($p$
      CREATE POLICY "Users can join public clubs" ON public.car_club_members
        FOR INSERT WITH CHECK (
          auth.uid() = user_id
          AND status = 'active'
          AND (
            (role = 'member' AND EXISTS (
              SELECT 1 FROM public.car_clubs c
              WHERE c.id = car_club_members.club_id AND c.is_public = true%s))
            OR
            (role = 'owner' AND EXISTS (
              SELECT 1 FROM public.car_clubs c
              WHERE c.id = car_club_members.club_id AND c.owner_id = auth.uid()))
          )
        )
    $p$, priv);
  END
  $do$
$q$);

SELECT pg_temp._apply('clubs: member UPDATE policy', 'car_club_members', $q$
  SELECT pg_temp._drop_policies('car_club_members', 'UPDATE');
  CREATE POLICY "Club admins can manage members" ON public.car_club_members
    FOR UPDATE
    USING (
      public.is_club_manager(car_club_members.club_id)
      AND role <> 'owner'
      AND (role = 'member' OR public.is_club_owner(car_club_members.club_id))
    )
    WITH CHECK (
      public.is_club_manager(car_club_members.club_id)
      AND role <> 'owner'
      AND (role = 'member' OR public.is_club_owner(car_club_members.club_id))
    );
$q$);

SELECT pg_temp._apply('clubs: member DELETE policy', 'car_club_members', $q$
  SELECT pg_temp._drop_policies('car_club_members', 'DELETE');
  CREATE POLICY "Users can leave clubs" ON public.car_club_members
    FOR DELETE USING (auth.uid() = user_id AND status <> 'banned' AND role <> 'owner');
$q$);

-- ============================================================================
-- 7. 檢舉與廣告：管理員判斷改用 profiles.is_admin
--    auth.jwt() -> 'user_metadata' 可由使用者自行寫入，不能用來授權。
-- ============================================================================
SELECT pg_temp._apply('reports: forum_post_reports admin policies', 'forum_post_reports', $q$
  DROP POLICY IF EXISTS "Admins can read forum post reports" ON public.forum_post_reports;
  DROP POLICY IF EXISTS "Admins can update forum post reports" ON public.forum_post_reports;
  CREATE POLICY "Admins can read forum post reports" ON public.forum_post_reports
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
  CREATE POLICY "Admins can update forum post reports" ON public.forum_post_reports
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
$q$);

SELECT pg_temp._apply('reports: article_reports policies', 'article_reports', $q$
  DROP POLICY IF EXISTS "Anyone can read reports" ON public.article_reports;
  DROP POLICY IF EXISTS "Users can view own or admin view all reports" ON public.article_reports;
  DROP POLICY IF EXISTS "Admins can update reports" ON public.article_reports;
  CREATE POLICY "Users can view own or admin view all reports" ON public.article_reports
    FOR SELECT USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
  CREATE POLICY "Admins can update reports" ON public.article_reports
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
$q$);

SELECT pg_temp._apply('reports: comment_reports policies', 'comment_reports', $q$
  DROP POLICY IF EXISTS "Anyone can read comment reports" ON public.comment_reports;
  DROP POLICY IF EXISTS "Users can view own or admin view all comment_reports" ON public.comment_reports;
  DROP POLICY IF EXISTS "Admins can update comment reports" ON public.comment_reports;
  CREATE POLICY "Users can view own or admin view all comment_reports" ON public.comment_reports
    FOR SELECT USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
  CREATE POLICY "Admins can update comment reports" ON public.comment_reports
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
$q$);

SELECT pg_temp._apply('ads: ad_placements admin policy', 'ad_placements', $q$
  DROP POLICY IF EXISTS "Admins can manage ads" ON public.ad_placements;
  CREATE POLICY "Admins can manage ads" ON public.ad_placements
    FOR ALL
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
    WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true));
$q$);

-- ============================================================================
-- 8. UPDATE policy 補上 WITH CHECK：不得把內容的作者改成別人
-- ============================================================================
SELECT pg_temp._apply('authorship: comments', 'comments', $q$
  SELECT pg_temp._drop_policies('comments', 'UPDATE');
  CREATE POLICY "Users can update own comments" ON public.comments
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
$q$);
SELECT pg_temp._apply('authorship: forum_posts', 'forum_posts', $q$
  SELECT pg_temp._drop_policies('forum_posts', 'UPDATE');
  CREATE POLICY "Users can update own posts" ON public.forum_posts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
$q$);
SELECT pg_temp._apply('authorship: forum_replies', 'forum_replies', $q$
  SELECT pg_temp._drop_policies('forum_replies', 'UPDATE');
  CREATE POLICY "Users can update own replies" ON public.forum_replies
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
$q$);
SELECT pg_temp._apply('authorship: user_cars', 'user_cars', $q$
  SELECT pg_temp._drop_policies('user_cars', 'UPDATE');
  CREATE POLICY "Users can update own cars" ON public.user_cars
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
$q$);
SELECT pg_temp._apply('authorship: car_club_posts', 'car_club_posts', $q$
  SELECT pg_temp._drop_policies('car_club_posts', 'UPDATE');
  CREATE POLICY "Users can update own club posts" ON public.car_club_posts
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
$q$);

-- ============================================================================
-- 9. 可見範圍：與 20260316_rls_policy_adjustments / rls_review_fixes 的預期狀態一致
-- ============================================================================
SELECT pg_temp._apply('visibility: forum_posts select', 'forum_posts', $q$
  SELECT pg_temp._drop_policies('forum_posts', 'SELECT');
  CREATE POLICY "Forum posts are viewable by everyone" ON public.forum_posts
    FOR SELECT USING (is_approved = true OR auth.uid() = user_id);
$q$);
SELECT pg_temp._apply('visibility: forum_replies select', 'forum_replies', $q$
  SELECT pg_temp._drop_policies('forum_replies', 'SELECT');
  CREATE POLICY "Forum replies are viewable by everyone" ON public.forum_replies
    FOR SELECT USING (is_approved = true OR auth.uid() = user_id);
$q$);
SELECT pg_temp._apply('visibility: car_clubs select', 'car_clubs', $q$
  SELECT pg_temp._drop_policies('car_clubs', 'SELECT');
  CREATE POLICY "Public clubs are viewable by everyone" ON public.car_clubs
    FOR SELECT USING (
      is_public = true
      OR auth.uid() = owner_id
      OR EXISTS (SELECT 1 FROM public.car_club_members m
                 WHERE m.club_id = car_clubs.id AND m.user_id = auth.uid()));
$q$);
SELECT pg_temp._apply('visibility: car_club_posts select', 'car_club_posts', $q$
  SELECT pg_temp._drop_policies('car_club_posts', 'SELECT');
  CREATE POLICY "Club posts are viewable by members or public" ON public.car_club_posts
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.car_clubs c WHERE c.id = car_club_posts.club_id AND c.is_public = true)
      OR EXISTS (SELECT 1 FROM public.car_club_members m
                 WHERE m.club_id = car_club_posts.club_id AND m.user_id = auth.uid() AND m.status = 'active'));
$q$);
SELECT pg_temp._apply('visibility: car_club_replies select/insert', 'car_club_replies', $q$
  SELECT pg_temp._drop_policies('car_club_replies', 'SELECT');
  SELECT pg_temp._drop_policies('car_club_replies', 'INSERT');
  CREATE POLICY "Club replies follow club visibility" ON public.car_club_replies
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.car_club_posts p
        JOIN public.car_clubs c ON c.id = p.club_id
        WHERE p.id = car_club_replies.post_id
          AND (c.is_public = true
               OR EXISTS (SELECT 1 FROM public.car_club_members m
                          WHERE m.club_id = c.id AND m.user_id = auth.uid() AND m.status = 'active'))));
  CREATE POLICY "Members can reply to club posts" ON public.car_club_replies
    FOR INSERT WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM public.car_club_posts p
        JOIN public.car_club_members m ON m.club_id = p.club_id
        WHERE p.id = car_club_replies.post_id AND m.user_id = auth.uid() AND m.status = 'active'));
$q$);
SELECT pg_temp._apply('visibility: user_favorites select', 'user_favorites', $q$
  SELECT pg_temp._drop_policies('user_favorites', 'SELECT');
  CREATE POLICY "Users can view favorites" ON public.user_favorites
    FOR SELECT USING (
      auth.uid() = user_id
      OR EXISTS (SELECT 1 FROM public.profiles
                 WHERE profiles.id = user_favorites.user_id AND profiles.is_favorites_public = true));
$q$);

-- ============================================================================
-- 10. 安全網：移除任何仍依賴 user_metadata 的 policy
-- ============================================================================
DO $do$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND (coalesce(qual, '') ILIKE '%user_metadata%' OR coalesce(with_check, '') ILIKE '%user_metadata%')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, pol.tablename);
    INSERT INTO _hardening_log VALUES ('safety net: dropped user_metadata policy ' || pol.tablename || '.' || pol.policyname, true, NULL);
  END LOOP;
END
$do$;

-- ============================================================================
-- 結果表：失敗列在最前面。ok = false 的列需要處理。
-- ============================================================================
SELECT step, ok, detail
FROM (
  SELECT step, ok, detail, 1 AS ord FROM _hardening_log
  UNION ALL
  SELECT 'CHECK: 所有 public 資料表都已啟用 RLS',
         NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity),
         (SELECT string_agg(c.relname, ', ' ORDER BY c.relname) FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND NOT c.relrowsecurity),
         2
  UNION ALL
  SELECT 'CHECK: anon / authenticated 對 generated_articles 無寫入權限',
         NOT (has_table_privilege('anon', 'public.generated_articles', 'UPDATE')
              OR has_table_privilege('anon', 'public.generated_articles', 'DELETE')
              OR has_table_privilege('anon', 'public.generated_articles', 'INSERT')
              OR has_table_privilege('authenticated', 'public.generated_articles', 'UPDATE')
              OR has_table_privilege('authenticated', 'public.generated_articles', 'DELETE')),
         NULL, 2
  WHERE to_regclass('public.generated_articles') IS NOT NULL
  UNION ALL
  SELECT 'CHECK: 已登入會員無法讀取 meta_credentials',
         NOT has_table_privilege('authenticated', 'public.meta_credentials', 'SELECT'),
         NULL, 2
  WHERE to_regclass('public.meta_credentials') IS NOT NULL
  UNION ALL
  SELECT 'CHECK: 沒有 policy 依賴 user_metadata',
         NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
                       AND (coalesce(qual, '') ILIKE '%user_metadata%' OR coalesce(with_check, '') ILIKE '%user_metadata%')),
         NULL, 2
  UNION ALL
  SELECT 'CHECK: 計數函式皆為 SECURITY DEFINER',
         NOT EXISTS (SELECT 1 FROM pg_proc p
                      WHERE p.pronamespace = 'public'::regnamespace
                        AND p.proname IN ('update_article_comments_count', 'update_article_favorites_count',
                                          'update_article_likes_count', 'update_article_share_count',
                                          'increment_share_count', 'update_comment_likes_count')
                        AND NOT p.prosecdef),
         (SELECT string_agg(p.proname, ', ') FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace
             AND p.proname IN ('update_article_comments_count', 'update_article_favorites_count',
                               'update_article_likes_count', 'update_article_share_count',
                               'increment_share_count', 'update_comment_likes_count')
             AND NOT p.prosecdef),
         2
) r
ORDER BY ok, ord, step;
