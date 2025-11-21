-- ============================================
-- Admin 系統改進: Session 管理 + 操作日誌
-- ============================================

-- 1. Admin Sessions 表 (替代直接在 Cookie 存 userId)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,  -- 用於 Cookie 的 session token
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- 自動清理過期 Session 的函數
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 定期清理過期 Session (可選:需要 pg_cron 擴展)
-- SELECT cron.schedule('cleanup-sessions', '0 * * * *', 'SELECT cleanup_expired_sessions()');

-- 註釋
COMMENT ON TABLE admin_sessions IS 'Admin 登入 session 管理';
COMMENT ON COLUMN admin_sessions.token IS 'Cookie 中存儲的 session token (SHA-256 hash)';
COMMENT ON COLUMN admin_sessions.expires_at IS '過期時間 (預設 7 天)';


-- 2. Audit Log 表 (追蹤所有管理操作)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT NOT NULL,  -- 冗餘儲存,防止用戶刪除後無法追蹤
  action VARCHAR(50) NOT NULL,  -- login, logout, update_article, delete_article, etc.
  resource_type VARCHAR(50),    -- article, user, settings, etc.
  resource_id TEXT,              -- 被操作的資源 ID
  changes JSONB,                 -- 變更內容 (before/after)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_audit_log_user_id ON admin_audit_log(user_id);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);

-- 註釋
COMMENT ON TABLE admin_audit_log IS 'Admin 操作審計日誌';
COMMENT ON COLUMN admin_audit_log.changes IS 'JSON 格式儲存變更內容,例如: {"before": {...}, "after": {...}}';


-- 3. Login Attempts 表 (Rate Limiting / 防暴力破解)
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address INET NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引優化
CREATE INDEX idx_login_attempts_email ON admin_login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON admin_login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_login_attempts_created_at ON admin_login_attempts(created_at);

-- 檢查登入失敗次數的函數 (15分鐘內失敗 5 次則鎖定)
CREATE OR REPLACE FUNCTION check_login_rate_limit(
  p_email TEXT,
  p_ip_address INET
) RETURNS BOOLEAN AS $$
DECLARE
  failed_count INTEGER;
BEGIN
  -- 計算過去 15 分鐘內的失敗次數
  SELECT COUNT(*)
  INTO failed_count
  FROM admin_login_attempts
  WHERE (email = p_email OR ip_address = p_ip_address)
    AND success = FALSE
    AND created_at > NOW() - INTERVAL '15 minutes';

  -- 失敗 5 次以上則鎖定
  RETURN failed_count < 5;
END;
$$ LANGUAGE plpgsql;

-- 清理舊的登入記錄 (保留 30 天)
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_login_attempts WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 註釋
COMMENT ON TABLE admin_login_attempts IS 'Admin 登入嘗試記錄 (用於 rate limiting)';
COMMENT ON FUNCTION check_login_rate_limit IS '檢查是否超過登入失敗次數限制 (15分鐘內 5 次)';


-- 4. RLS 政策 (Row Level Security)

-- admin_sessions: 只有自己可以查看自己的 session
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sessions"
  ON admin_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- admin_audit_log: 只有 admin 可以查看日誌
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit log"
  ON admin_audit_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- admin_login_attempts: 系統表,禁止一般查詢
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only service role can access login attempts"
  ON admin_login_attempts FOR ALL
  USING (false);  -- 禁止所有直接查詢,只能通過 service role


-- 5. 輔助函數: 記錄審計日誌
CREATE OR REPLACE FUNCTION log_admin_action(
  p_user_id UUID,
  p_user_email TEXT,
  p_action VARCHAR(50),
  p_resource_type VARCHAR(50) DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL,
  p_changes JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO admin_audit_log (
    user_id, user_email, action, resource_type, resource_id,
    changes, ip_address, user_agent
  ) VALUES (
    p_user_id, p_user_email, p_action, p_resource_type, p_resource_id,
    p_changes, p_ip_address, p_user_agent
  );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_admin_action IS '記錄 admin 操作到審計日誌';


-- 6. 輔助視圖: 活躍的 Admin Sessions
CREATE OR REPLACE VIEW active_admin_sessions AS
SELECT
  s.id,
  s.user_id,
  p.email,
  s.ip_address,
  s.created_at,
  s.expires_at,
  s.last_activity_at,
  EXTRACT(EPOCH FROM (s.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM admin_sessions s
JOIN auth.users u ON s.user_id = u.id
JOIN profiles p ON s.user_id = p.id
WHERE s.expires_at > NOW()
  AND p.is_admin = TRUE
ORDER BY s.last_activity_at DESC;

COMMENT ON VIEW active_admin_sessions IS '當前活躍的 Admin Sessions';


-- 7. 初始數據清理
-- 如果您已經有舊的 sessions,可以手動清理
-- DELETE FROM admin_sessions WHERE expires_at < NOW();
