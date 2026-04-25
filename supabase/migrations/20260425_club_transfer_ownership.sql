-- =====================================================================
-- Club Ownership Transfer（對應 docs/MEMBER_AUDIT_2026-04.md P1 #10）
--
-- 原本：car_clubs.owner_id 是 NOT NULL，且 owner 不能 leave
--       帳號失活的 owner 會讓整個 club 變孤兒，無法解散也無法接管
--
-- 此 RPC 讓 owner 可在退出前轉讓給 active member：
--   - 必須由 current owner 呼叫（auth.uid() check）
--   - 新 owner 必須是該 club 的 active member 且非自己
--   - 原 owner 自動降為 admin（保留 club 管理能力）
--   - 新 owner role 升為 owner
--   - 整段在單一 transaction 內，避免中途 inconsistent state
-- =====================================================================

CREATE OR REPLACE FUNCTION transfer_club_ownership(
  p_club_id UUID,
  p_new_owner_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_owner_id UUID;
  v_new_owner_status TEXT;
BEGIN
  -- 取現任 owner
  SELECT owner_id INTO v_current_owner_id
  FROM car_clubs
  WHERE id = p_club_id;

  IF v_current_owner_id IS NULL THEN
    RAISE EXCEPTION 'Club not found' USING ERRCODE = 'P0002';
  END IF;

  -- 權限檢查：呼叫者必須是 current owner
  IF v_current_owner_id != auth.uid() THEN
    RAISE EXCEPTION 'Only current owner can transfer ownership' USING ERRCODE = '42501';
  END IF;

  -- 不能轉給自己
  IF p_new_owner_id = v_current_owner_id THEN
    RAISE EXCEPTION 'Cannot transfer to current owner' USING ERRCODE = '22023';
  END IF;

  -- 新 owner 必須是 active member
  SELECT status INTO v_new_owner_status
  FROM car_club_members
  WHERE club_id = p_club_id AND user_id = p_new_owner_id;

  IF v_new_owner_status IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this club' USING ERRCODE = 'P0002';
  END IF;
  IF v_new_owner_status != 'active' THEN
    RAISE EXCEPTION 'Target user must be an active member' USING ERRCODE = '22023';
  END IF;

  -- Atomic transition：
  -- 1. 原 owner 降為 admin（保留管理權，方便交接後仍可協助）
  UPDATE car_club_members
  SET role = 'admin'
  WHERE club_id = p_club_id AND user_id = v_current_owner_id;

  -- 2. 新 owner 升為 owner
  UPDATE car_club_members
  SET role = 'owner'
  WHERE club_id = p_club_id AND user_id = p_new_owner_id;

  -- 3. car_clubs.owner_id 切換
  UPDATE car_clubs
  SET owner_id = p_new_owner_id, updated_at = NOW()
  WHERE id = p_club_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION transfer_club_ownership IS
  'Atomically transfer car_clubs ownership: validates caller is current owner, target is active member; demotes old owner to admin and promotes target to owner. Added 2026-04-25.';
