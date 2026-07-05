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
-- 層 2（主防線）：BEFORE UPDATE trigger
-- 任何「改變 is_admin 值」且非 service_role / DBA 的更新一律拒絕。
-- SECURITY INVOKER（預設）確保 current_user 反映真實請求者：
--   PostgREST 會對請求 SET ROLE 到 anon / authenticated / service_role，
--   Supabase SQL editor / migration 則是 postgres / supabase_admin。
-- 只有「真的變更 is_admin」才會觸發（IS DISTINCT FROM），
-- 因此使用者正常更新 bio / username / avatar 完全不受影響。
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_is_admin_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin)
     AND current_user NOT IN ('service_role', 'supabase_admin', 'postgres')
  THEN
    RAISE EXCEPTION 'Forbidden: profiles.is_admin can only be changed by service_role'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_is_admin_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_is_admin_self_escalation
  BEFORE UPDATE ON public.profiles
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
-- 驗證（套用後在 Supabase SQL editor 以「一般使用者」情境手動確認）：
--   1. 用某會員的 anon JWT（非 service_role）執行：
--        UPDATE public.profiles SET is_admin = true WHERE id = auth.uid();
--      預期：ERROR，insufficient_privilege（trigger 擋下）。
--   2. 同一使用者更新非敏感欄位：
--        UPDATE public.profiles SET bio = 'hello' WHERE id = auth.uid();
--      預期：成功（不受影響）。
--   3. 以 service_role 執行 is_admin 設定：
--        UPDATE public.profiles SET is_admin = true WHERE id = '<uid>';
--      預期:成功(後台指派 admin 的正常路徑不被破壞)。
-- ============================================================
