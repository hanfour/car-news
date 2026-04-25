-- =====================================================================
-- 會員子系統審計 P1 修復（對應 docs/MEMBER_AUDIT_2026-04.md）
--
-- 1. find_or_create_conversation 加 user_blocks 雙向檢查
-- 2. notification_settings 加 direct_message 欄位（預設 true）
-- 3. on_new_message trigger 整合 notification_settings.direct_message
--    與 user_blocks（被封鎖時不寫通知）
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. notification_settings 加 direct_message 欄位
-- ---------------------------------------------------------------------
ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS direct_message BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN notification_settings.direct_message IS
  '是否接收 DM 通知（false 時 on_new_message trigger 不會寫入 notifications）';

-- ---------------------------------------------------------------------
-- 2. find_or_create_conversation 加 block 檢查
--    被任一方封鎖即拒絕建立對話，避免被封鎖者透過此 RPC 繞過
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION find_or_create_conversation(p_user1 UUID, p_user2 UUID)
RETURNS UUID AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- 權限檢查：呼叫者必須是 p_user1
  IF p_user1 != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: caller must be p_user1';
  END IF;

  -- 不能與自己對話
  IF p_user1 = p_user2 THEN
    RAISE EXCEPTION 'Cannot create conversation with self';
  END IF;

  -- 雙向 block 檢查：任一方封鎖另一方都拒絕
  IF EXISTS (
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = p_user1 AND blocked_id = p_user2)
       OR (blocker_id = p_user2 AND blocked_id = p_user1)
  ) THEN
    RAISE EXCEPTION 'Cannot create conversation with blocked user';
  END IF;

  -- 找到現有對話
  SELECT cp1.conversation_id INTO v_conversation_id
  FROM conversation_participants cp1
  INNER JOIN conversation_participants cp2
    ON cp1.conversation_id = cp2.conversation_id
  WHERE cp1.user_id = p_user1
    AND cp2.user_id = p_user2
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  -- 建立新對話
  INSERT INTO conversations DEFAULT VALUES
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, p_user1), (v_conversation_id, p_user2);

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION find_or_create_conversation IS
  'Find existing or create new DM conversation. Refuses if either side has blocked the other (added 2026-04-25).';

-- ---------------------------------------------------------------------
-- 3. on_new_message trigger 整合 notification_settings + user_blocks
--    - notification_settings.direct_message=false 不寫通知
--    - notification_settings 不存在 → 預設 true（新使用者尚未 INSERT settings 時）
--    - 雙向 block 不寫通知（保險，雖然 find_or_create_conversation 已擋；
--      若用既存 conversation 後一方才封鎖，新訊息也不通知）
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION on_new_message()
RETURNS TRIGGER AS $$
BEGIN
  -- 更新對話的最後訊息
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = LEFT(NEW.content, 100),
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  -- 發送通知給其他參與者
  INSERT INTO notifications (recipient_id, actor_id, type, body, resource_type, resource_id, metadata)
  SELECT
    cp.user_id,
    NEW.sender_id,
    'direct_message',
    LEFT(NEW.content, 100),
    'conversation',
    NEW.conversation_id::TEXT,
    jsonb_build_object('conversation_id', NEW.conversation_id::TEXT)
  FROM conversation_participants cp
  LEFT JOIN notification_settings ns ON ns.user_id = cp.user_id
  WHERE cp.conversation_id = NEW.conversation_id
    AND cp.user_id != NEW.sender_id
    AND cp.is_muted = FALSE
    -- 尊重使用者通知設定（NULL = 未設定 = 預設 true）
    AND COALESCE(ns.direct_message, TRUE) = TRUE
    -- 雙向 block 檢查（接收端封鎖發送端，或發送端封鎖接收端）
    AND NOT EXISTS (
      SELECT 1 FROM user_blocks ub
      WHERE (ub.blocker_id = cp.user_id AND ub.blocked_id = NEW.sender_id)
         OR (ub.blocker_id = NEW.sender_id AND ub.blocked_id = cp.user_id)
    )
    -- 同一對話 5 分鐘內不重複通知
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.recipient_id = cp.user_id
        AND n.actor_id = NEW.sender_id
        AND n.type = 'direct_message'
        AND n.resource_id = NEW.conversation_id::TEXT
        AND n.created_at > NOW() - INTERVAL '5 minutes'
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION on_new_message IS
  'DM 觸發器：更新 conversations 並發 notification（尊重 notification_settings.direct_message + user_blocks）。Updated 2026-04-25.';
