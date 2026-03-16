-- 車友會邀請機制
CREATE TABLE club_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES car_clubs(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES auth.users(id),
  invitee_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- 同一車友會同一被邀請者只能有一個 pending 邀請
CREATE UNIQUE INDEX idx_club_invitations_unique_pending
  ON club_invitations (club_id, invitee_id)
  WHERE status = 'pending';

-- 查詢索引
CREATE INDEX idx_club_invitations_invitee ON club_invitations (invitee_id, status);
CREATE INDEX idx_club_invitations_club ON club_invitations (club_id, status);

-- RLS
ALTER TABLE club_invitations ENABLE ROW LEVEL SECURITY;

-- 邀請者或被邀請者可以查看
CREATE POLICY "Users can view their invitations"
  ON club_invitations FOR SELECT
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- 車友會 owner/admin 可以建立邀請
CREATE POLICY "Club admins can create invitations"
  ON club_invitations FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM car_club_members
      WHERE club_id = club_invitations.club_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND status = 'active'
    )
  );

-- 被邀請者可以更新（接受/拒絕）
CREATE POLICY "Invitees can respond to invitations"
  ON club_invitations FOR UPDATE
  USING (invitee_id = auth.uid() AND status = 'pending')
  WITH CHECK (invitee_id = auth.uid() AND status IN ('accepted', 'declined'));

-- 邀請通知 trigger
CREATE OR REPLACE FUNCTION notify_club_invitation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (recipient_id, actor_id, type, body, resource_type, resource_id, metadata)
  VALUES (
    NEW.invitee_id,
    NEW.inviter_id,
    'club_invitation',
    NEW.message,
    'club_invitation',
    NEW.id::TEXT,
    jsonb_build_object(
      'club_id', NEW.club_id::TEXT,
      'invitation_id', NEW.id::TEXT
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_club_invitation_notify
  AFTER INSERT ON club_invitations
  FOR EACH ROW
  EXECUTE FUNCTION notify_club_invitation();
