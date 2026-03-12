-- Threads User ID 與 Instagram Account ID 是不同的
-- Threads User ID 需透過 Threads OAuth 流程取得
ALTER TABLE meta_credentials
ADD COLUMN IF NOT EXISTS threads_user_id TEXT;

COMMENT ON COLUMN meta_credentials.threads_user_id IS 'Threads User ID (separate from Instagram Account ID, obtained via Threads OAuth)';
