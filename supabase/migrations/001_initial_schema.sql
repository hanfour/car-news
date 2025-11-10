-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 來源文章表
CREATE TABLE raw_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    embedding VECTOR(1536),

    -- 索引
    CONSTRAINT chk_expires_at CHECK (expires_at > scraped_at)
);

CREATE INDEX idx_raw_articles_expires_at ON raw_articles(expires_at);
CREATE INDEX idx_raw_articles_embedding ON raw_articles USING ivfflat (embedding vector_cosine_ops);

-- 自動清理過期文章函數
CREATE OR REPLACE FUNCTION cleanup_expired_articles()
RETURNS void AS $$
BEGIN
    DELETE FROM raw_articles WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

---

-- 聚類表（臨時）
CREATE TABLE article_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_article_ids UUID[] NOT NULL,
    centroid VECTOR(1536),
    similarity_avg FLOAT NOT NULL CHECK (similarity_avg >= 0 AND similarity_avg <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

---

-- 生成文章表
CREATE TABLE generated_articles (
    id CHAR(7) PRIMARY KEY,
    cluster_id UUID REFERENCES article_clusters(id),

    -- 內容
    title_zh TEXT NOT NULL,
    content_zh TEXT NOT NULL,
    slug_en VARCHAR(200) NOT NULL,
    source_urls TEXT[] NOT NULL,

    -- 質量控制
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    quality_checks JSONB NOT NULL DEFAULT '{
        "has_data": false,
        "has_sources": false,
        "has_banned_words": false,
        "has_unverified": false,
        "structure_valid": false
    }',
    reasoning TEXT,

    -- 版本
    style_version VARCHAR(10) NOT NULL DEFAULT 'v1.0',

    -- 發布
    published BOOLEAN NOT NULL DEFAULT false,
    published_at DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 統計
    view_count INTEGER NOT NULL DEFAULT 0,
    share_count INTEGER NOT NULL DEFAULT 0,

    -- 約束
    CONSTRAINT chk_published_date CHECK (published = false OR published_at IS NOT NULL),
    CONSTRAINT unique_published_slug UNIQUE (published_at, slug_en)
);

CREATE INDEX idx_generated_published ON generated_articles(published, published_at DESC) WHERE published = true;
CREATE INDEX idx_generated_published_at ON generated_articles(published_at DESC);

---

-- 每日主題鎖（防重複）
CREATE TABLE daily_topic_locks (
    date DATE NOT NULL,
    topic_hash CHAR(64) NOT NULL,
    article_id CHAR(7) REFERENCES generated_articles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (date, topic_hash)
);

-- 自動清理舊鎖（保留7天）
CREATE OR REPLACE FUNCTION cleanup_old_locks()
RETURNS void AS $$
BEGIN
    DELETE FROM daily_topic_locks WHERE date < CURRENT_DATE - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

---

-- 評論表
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id CHAR(7) REFERENCES generated_articles(id) ON DELETE CASCADE,
    author_name VARCHAR(50) NOT NULL,
    content TEXT NOT NULL CHECK (LENGTH(content) >= 1 AND LENGTH(content) <= 2000),

    -- AI審核
    ai_moderation JSONB NOT NULL DEFAULT '{
        "passed": false,
        "confidence": 0,
        "flags": []
    }',
    visible BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_article_visible ON comments(article_id, visible, created_at DESC);

---

-- 分享事件表
CREATE TABLE share_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id CHAR(7) REFERENCES generated_articles(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'twitter', 'line', 'copy')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_events_article ON share_events(article_id, platform, created_at);

---

-- 風格配置表（版本管理）
CREATE TABLE style_configs (
    version VARCHAR(10) PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    style_guide TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 確保只有一個active配置
CREATE UNIQUE INDEX idx_one_active_style ON style_configs (active) WHERE active = true;

---

-- 觸發器：發布文章時更新published_at
CREATE OR REPLACE FUNCTION set_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.published = true AND (OLD IS NULL OR OLD.published = false) THEN
        NEW.published_at = CURRENT_DATE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_published_at
BEFORE INSERT OR UPDATE ON generated_articles
FOR EACH ROW
EXECUTE FUNCTION set_published_at();

---

-- 觸發器：分享事件增加計數
CREATE OR REPLACE FUNCTION increment_share_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE generated_articles
    SET share_count = share_count + 1
    WHERE id = NEW.article_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_share
AFTER INSERT ON share_events
FOR EACH ROW
EXECUTE FUNCTION increment_share_count();

---

-- 視圖：已發布文章（優化查詢）
CREATE VIEW published_articles AS
SELECT
    id,
    title_zh,
    content_zh,
    slug_en,
    source_urls,
    published_at,
    view_count,
    share_count,
    created_at
FROM generated_articles
WHERE published = true
ORDER BY published_at DESC, created_at DESC;

---

-- Cron日誌表（用於監控）
CREATE TABLE cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error')),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cron_logs_job ON cron_logs(job_name, status, created_at DESC);

---

-- 插入初始風格配置
INSERT INTO style_configs (version, system_prompt, style_guide, active) VALUES (
    'v1.0',
    '# 角色定義
你是一位資深汽車產業媒體人，擁有15年從業經驗。',
    '# 文章結構模板
參見 style-guide.txt',
    true
);
