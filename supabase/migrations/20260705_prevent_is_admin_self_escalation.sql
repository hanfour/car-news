-- ============================================================
-- S1 修復:防止會員自行提權為 admin(CRITICAL)
-- 日期: 2026-07-05
-- ============================================================
-- 問題：profiles 的 UPDATE policy（005_add_user_system.sql）只檢查
--   USING (auth.uid() = id)，沒有 WITH CHECK、沒有欄位限制。
--   Postgres 的 row-level policy 預設不管「改了哪個欄位」，因此任何
--   已登入會員可用公開 anon key + 自己的 JWT 直接對 PostgREST 送
--   PATCH /rest/v1/profiles?id=eq.<自己> {"is_admin": true} 提權為 admin
--   （verifyAdminAuth 與所有 admin RLS 都以 profiles.is_admin 為準）。
--
-- 修法採三層縱深防禦。主防線是 trigger（層 2），因為它不依賴
-- PostgREST 的 grant 模型、對所有寫入路徑（含未來新端點）都有效。
-- ============================================================

-- ------------------------------------------------------------
-- 層 1（額外）：欄位級 REVOKE
-- 讓 PostgREST 的 anon / authenticated role 不具備寫 is_admin 的欄位權限。
-- 註：若存在 table-level UPDATE grant，column REVOKE 不會單獨生效
--     （PostgreSQL 的 table-level 與 column-level 權限各自累加），
--     故此層僅為輔助，真正的攔截由層 2 的 trigger 負責。
-- ------------------------------------------------------------
REVOKE UPDATE (is_admin) ON public.profiles FROM anon, authenticated;

-- ------------------------------------------------------------
-- 層 2（主防線）：BEFORE INSERT OR UPDATE trigger
-- 涵蓋 INSERT 與 UPDATE 兩條路徑（INSERT 也要防：profiles 的 INSERT policy
-- 只檢查 auth.uid()=id、不限 is_admin,若某使用者的 profile 列缺失,
-- 他可 INSERT 自己的列並帶 is_admin=true 繞過只保護 UPDATE 的舊版）。
-- SECURITY INVOKER（預設）確保 current_user 反映真實請求者：
--   PostgREST 會對請求 SET ROLE 到 anon / authenticated / service_role，
--   Supabase SQL editor / migration 則是 postgres / supabase_admin。
-- 註冊時的 handle_new_user() 以預設值(is_admin=false)建列,NEW.is_admin
-- 不為 true,不受影響;只有「非授權角色把 is_admin 設/改為 true」才擋。
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_is_admin_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('service_role', 'supabase_admin', 'postgres') THEN
    RETURN NEW;  -- service_role / DBA 放行(後台指派 admin 的正常路徑)
  END IF;

  IF TG_OP = 'INSERT' AND NEW.is_admin IS TRUE THEN
    RAISE EXCEPTION 'Forbidden: profiles.is_admin can only be set by service_role'
      USING ERRCODE = 'insufficient_privilege';
  ELSIF TG_OP = 'UPDATE' AND (NEW.is_admin IS DISTINCT FROM OLD.is_admin) THEN
    RAISE EXCEPTION 'Forbidden: profiles.is_admin can only be changed by service_role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_is_admin_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_is_admin_self_escalation
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_is_admin_self_escalation();

-- ------------------------------------------------------------
-- 層 3：UPDATE policy 補上 WITH CHECK
-- 原 policy 只有 USING（決定「能看到哪些列可更新」），沒有 WITH CHECK
-- （決定「更新後的列是否合法」）。補上以擋 id 被竄改成他人 uid 的情況。
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 驗證（重要：Supabase SQL Editor 以 postgres 身分執行,會被 trigger 放行,
--  因此「直接在 editor 跑 UPDATE ... is_admin=true」一定成功,測不到攔截。
--  要測攔截必須在同一交易內切換成 authenticated role + 設 JWT claims）:
--
--   1. 測攔截(模擬一般會員 —— 預期 ERROR insufficient_privilege):
--        BEGIN;
--          SET LOCAL ROLE authenticated;
--          SET LOCAL request.jwt.claims = '{"sub":"<某會員uid>","role":"authenticated"}';
--          UPDATE public.profiles SET is_admin = true WHERE id = '<某會員uid>';
--        ROLLBACK;
--      （INSERT is_admin=true 同樣被擋。）
--
--   2. 測不影響一般更新(同樣模擬會員 —— 預期成功):
--        BEGIN;
--          SET LOCAL ROLE authenticated;
--          SET LOCAL request.jwt.claims = '{"sub":"<uid>","role":"authenticated"}';
--          UPDATE public.profiles SET display_name = 'test' WHERE id = '<uid>';
--        ROLLBACK;
--
--   3. service_role / postgres 仍可指派 admin(直接在 editor 跑即可 —— 預期成功):
--        UPDATE public.profiles SET is_admin = true WHERE id = '<uid>';
-- ============================================================
