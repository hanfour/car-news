-- ai_usage_logs: 記錄每次 AI provider call 的用量與估算成本
--
-- 動機：
-- - Anthropic / Google / fal.ai 各自的 dashboard 需要分別登入查看
-- - 缺乏整合視角看「整體月成本 / 各 provider 比例 / 趨勢」
-- - 也沒有結構化資料可給 admin dashboard 用
--
-- 由 src/lib/ai/usage-tracker.ts:recordAIUsage() 寫入（fire-and-forget，不阻塞 hot path）

CREATE TABLE ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- provider 與 model
    provider VARCHAR(20) NOT NULL,           -- 'claude' | 'gemini' | 'openai' | 'fal'
    model VARCHAR(80),                        -- 例：'gemini-2.5-flash', 'claude-3-5-haiku-20241022'

    -- 用途分類，方便篩選
    purpose VARCHAR(40) NOT NULL,             -- 'article_generation' | 'moderation' | 'text_generation' | 'vision_scoring' | 'image_generation' | 'embedding'

    -- 用量
    input_tokens INTEGER,                     -- nullable：圖片生成等非 token 計費的場景留空
    output_tokens INTEGER,                    -- 同上
    cost_usd NUMERIC(10, 6),                  -- 估算成本（依 PRICING 表算出）

    -- 成功與否（fallback 路徑也算一次 call）
    success BOOLEAN NOT NULL DEFAULT TRUE,

    -- 自由欄位（記 article_id、cluster size、retry 次數等）
    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 主查詢索引：時間範圍掃描
CREATE INDEX idx_ai_usage_created_at ON ai_usage_logs(created_at DESC);

-- 二級索引：provider + purpose 細分時加速
CREATE INDEX idx_ai_usage_provider_purpose
    ON ai_usage_logs(provider, purpose, created_at DESC);

COMMENT ON TABLE ai_usage_logs IS 'AI provider call 記錄。由 recordAIUsage() 非同步寫入，不阻塞 hot path。';
