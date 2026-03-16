-- Image Experiments: 自動化 prompt 優化迴圈
-- 用於追蹤不同參數組合的圖片生成品質

CREATE TABLE IF NOT EXISTS image_experiments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed
  config JSONB NOT NULL,
  results JSONB,
  summary JSONB,
  total_cost_usd NUMERIC(8,4) DEFAULT 0,
  total_images INTEGER DEFAULT 0,
  baseline_experiment_id TEXT REFERENCES image_experiments(id),
  improvement_pct NUMERIC(5,2),
  promoted BOOLEAN DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS image_experiment_samples (
  id SERIAL PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES image_experiments(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  article_title TEXT NOT NULL,
  prompt_used TEXT NOT NULL,
  image_url TEXT,
  seed_used INTEGER,
  generation_time_ms INTEGER,
  scores JSONB,
  composite_score NUMERIC(4,2),
  score_explanation TEXT,
  cost_usd NUMERIC(8,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_experiments_status ON image_experiments(status);
CREATE INDEX IF NOT EXISTS idx_experiments_promoted ON image_experiments(promoted) WHERE promoted = TRUE;
CREATE INDEX IF NOT EXISTS idx_experiment_samples_experiment ON image_experiment_samples(experiment_id);
CREATE INDEX IF NOT EXISTS idx_experiment_samples_score ON image_experiment_samples(composite_score DESC);
