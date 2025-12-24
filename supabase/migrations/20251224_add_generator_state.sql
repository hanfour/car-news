-- Generator State Table
-- 用於存儲 generator 的持久化狀態（如輪盤位置）

CREATE TABLE IF NOT EXISTS generator_state (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 添加索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_generator_state_updated_at ON generator_state(updated_at);

-- RLS 政策：只有服務端可以訪問
ALTER TABLE generator_state ENABLE ROW LEVEL SECURITY;

-- 服務端可以完全訪問（使用 service_role key）
CREATE POLICY "Service role can manage generator_state"
  ON generator_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 添加註釋
COMMENT ON TABLE generator_state IS '存儲 generator 的持久化狀態，如品牌輪盤位置';
COMMENT ON COLUMN generator_state.key IS '狀態鍵名';
COMMENT ON COLUMN generator_state.value IS '狀態值（JSON格式）';
COMMENT ON COLUMN generator_state.updated_at IS '最後更新時間';
