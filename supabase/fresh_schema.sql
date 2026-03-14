-- ============================================================================
-- WantCar.autos 完整 Schema（全新專案用）
-- 生成日期: 2026-03-14
-- ============================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. Core Content Tables
-- ============================================================================

-- 來源文章表
CREATE TABLE raw_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    embedding VECTOR(768),
    image_url TEXT,
    image_credit TEXT,
    extracted_brands TEXT[] DEFAULT '{}',
    published_at TIMESTAMPTZ,
    source_published_at TIMESTAMPTZ,
    used_in_article_id CHAR(7),
    CONSTRAINT chk_expires_at CHECK (expires_at > scraped_at)
);

CREATE INDEX idx_raw_articles_expires_at ON raw_articles(expires_at);
CREATE INDEX idx_raw_articles_embedding ON raw_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_raw_articles_published_at ON raw_articles(published_at);
CREATE INDEX idx_raw_articles_source_published_at ON raw_articles(source_published_at DESC NULLS LAST);
CREATE INDEX idx_raw_articles_scraped_at ON raw_articles(scraped_at DESC);

-- 聚類表
CREATE TABLE article_clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    raw_article_ids UUID[] NOT NULL,
    centroid VECTOR(768),
    similarity_avg FLOAT NOT NULL CHECK (similarity_avg >= 0 AND similarity_avg <= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 生成文章表
CREATE TABLE generated_articles (
    id CHAR(7) PRIMARY KEY,
    cluster_id UUID REFERENCES article_clusters(id),
    title_zh TEXT NOT NULL,
    content_zh TEXT NOT NULL,
    slug_en VARCHAR(200) NOT NULL,
    source_urls TEXT[] NOT NULL,
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
    quality_checks JSONB NOT NULL DEFAULT '{"has_data":false,"has_sources":false,"has_banned_words":false,"has_unverified":false,"structure_valid":false}',
    reasoning TEXT,
    style_version VARCHAR(10) NOT NULL DEFAULT 'v1.0',
    published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    view_count INTEGER NOT NULL DEFAULT 0,
    share_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    tags JSONB DEFAULT '[]'::jsonb,
    is_featured BOOLEAN DEFAULT false,
    brands TEXT[] DEFAULT ARRAY[]::TEXT[],
    car_models TEXT[] DEFAULT ARRAY[]::TEXT[],
    categories TEXT[] DEFAULT ARRAY[]::TEXT[],
    cover_image TEXT,
    image_credit TEXT,
    primary_brand TEXT,
    images JSONB DEFAULT '[]'::jsonb,
    human_rating INTEGER CHECK (human_rating BETWEEN 1 AND 5),
    source_date TIMESTAMPTZ,
    source_published_at TIMESTAMPTZ,
    CONSTRAINT chk_published_date CHECK (published = false OR published_at IS NOT NULL),
    CONSTRAINT unique_published_slug UNIQUE (published_at, slug_en)
);

-- raw_articles FK (after generated_articles exists)
ALTER TABLE raw_articles ADD CONSTRAINT fk_raw_used_in FOREIGN KEY (used_in_article_id) REFERENCES generated_articles(id);
CREATE INDEX idx_raw_articles_used_in ON raw_articles(used_in_article_id) WHERE used_in_article_id IS NOT NULL;

-- generated_articles indexes
CREATE INDEX idx_generated_published ON generated_articles(published, published_at DESC) WHERE published = true;
CREATE INDEX idx_generated_published_at ON generated_articles(published_at DESC);
CREATE INDEX idx_generated_articles_is_featured ON generated_articles(is_featured) WHERE is_featured = true;
CREATE INDEX idx_generated_articles_brands ON generated_articles USING GIN(brands);
CREATE INDEX idx_generated_articles_car_models ON generated_articles USING GIN(car_models);
CREATE INDEX idx_generated_articles_categories ON generated_articles USING GIN(categories);
CREATE INDEX idx_generated_articles_tags ON generated_articles USING GIN(tags);
CREATE INDEX idx_generated_articles_primary_brand ON generated_articles(primary_brand);
CREATE INDEX idx_generated_articles_human_rating ON generated_articles(human_rating) WHERE human_rating IS NOT NULL;
CREATE INDEX idx_generated_articles_source_date ON generated_articles(source_date);
CREATE INDEX idx_generated_articles_source_published_at ON generated_articles(source_published_at DESC NULLS LAST);
CREATE INDEX idx_articles_brand_published ON generated_articles(primary_brand, published_at DESC) WHERE published = true;
CREATE INDEX idx_articles_category ON generated_articles USING GIN(categories) WHERE published = true;
CREATE INDEX idx_articles_search_zh ON generated_articles USING gin(to_tsvector('simple', coalesce(title_zh, '') || ' ' || coalesce(content_zh, '')));
CREATE INDEX idx_articles_popular ON generated_articles(view_count DESC NULLS LAST, published_at DESC) WHERE published = true;
CREATE INDEX idx_articles_recent ON generated_articles(published_at DESC) WHERE published = true;
CREATE INDEX idx_articles_tags ON generated_articles USING GIN(tags) WHERE published = true;
CREATE INDEX idx_articles_brands ON generated_articles USING GIN(brands) WHERE published = true;
CREATE INDEX idx_articles_published_date ON generated_articles(published, published_at DESC);
CREATE INDEX idx_articles_categories ON generated_articles USING GIN(categories);

-- 每日主題鎖
CREATE TABLE daily_topic_locks (
    date DATE NOT NULL,
    topic_hash CHAR(64) NOT NULL,
    article_id CHAR(7) REFERENCES generated_articles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (date, topic_hash)
);

-- 風格配置表
CREATE TABLE style_configs (
    version VARCHAR(10) PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    style_guide TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_one_active_style ON style_configs (active) WHERE active = true;

-- Cron 日誌表
CREATE TABLE cron_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'error')),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cron_logs_job ON cron_logs(job_name, status, created_at DESC);

-- Generator State
CREATE TABLE generator_state (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_generator_state_updated_at ON generator_state(updated_at);
ALTER TABLE generator_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage generator_state" ON generator_state FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- 2. User & Auth Tables
-- ============================================================================

CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE INDEX idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = TRUE;

-- User Favorites
CREATE TABLE user_favorites (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    article_id TEXT REFERENCES generated_articles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, article_id)
);
CREATE INDEX idx_favorites_user ON user_favorites(user_id);
CREATE INDEX idx_favorites_article ON user_favorites(article_id);
CREATE INDEX idx_favorites_created ON user_favorites(created_at DESC);
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own favorites" ON user_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own favorites" ON user_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorites" ON user_favorites FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 3. Comments & Engagement
-- ============================================================================

-- Comments (新版，含 user_id)
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id TEXT REFERENCES generated_articles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT true,
    moderation_result JSONB,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT content_not_empty CHECK (char_length(trim(content)) > 0)
);
CREATE INDEX idx_comments_article ON comments(article_id, created_at DESC);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);
CREATE INDEX idx_comments_approved ON comments(is_approved);
CREATE INDEX idx_comments_article_approved ON comments(article_id, created_at DESC) WHERE is_approved = true;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved comments are viewable by everyone" ON comments FOR SELECT USING (is_approved = true OR auth.uid() = user_id);
CREATE POLICY "Authenticated users can insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Comment Likes
CREATE TABLE comment_likes (
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user ON comment_likes(user_id);
CREATE INDEX idx_comment_likes_created ON comment_likes(created_at DESC);
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Comment likes are viewable by everyone" ON comment_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like comments" ON comment_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own likes" ON comment_likes FOR DELETE USING (auth.uid() = user_id);

-- Article Likes
CREATE TABLE article_likes (
    article_id TEXT REFERENCES generated_articles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (article_id, user_id)
);
CREATE INDEX idx_article_likes_article ON article_likes(article_id);
CREATE INDEX idx_article_likes_user ON article_likes(user_id);
CREATE INDEX idx_article_likes_created ON article_likes(created_at DESC);
ALTER TABLE article_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article likes are viewable by everyone" ON article_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like articles" ON article_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own likes" ON article_likes FOR DELETE USING (auth.uid() = user_id);

-- Article Shares
CREATE TABLE article_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id TEXT REFERENCES generated_articles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'twitter', 'line', 'instagram', 'copy')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_article_shares_article ON article_shares(article_id);
CREATE INDEX idx_article_shares_user ON article_shares(user_id);
CREATE INDEX idx_article_shares_platform ON article_shares(platform);
CREATE INDEX idx_article_shares_created ON article_shares(created_at DESC);
ALTER TABLE article_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Article shares are viewable by everyone" ON article_shares FOR SELECT USING (true);
CREATE POLICY "Anyone can record article shares" ON article_shares FOR INSERT WITH CHECK (true);

-- Legacy Share Events
CREATE TABLE share_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id CHAR(7) REFERENCES generated_articles(id) ON DELETE CASCADE,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('facebook', 'twitter', 'line', 'copy')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_share_events_article ON share_events(article_id, platform, created_at);

-- ============================================================================
-- 4. Reports & Ads
-- ============================================================================

CREATE TABLE article_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id TEXT REFERENCES generated_articles(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'misinformation', 'inappropriate', 'copyright', 'other')),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_article_reports_article ON article_reports(article_id);
CREATE INDEX idx_article_reports_user ON article_reports(user_id);
CREATE INDEX idx_article_reports_status ON article_reports(status);
CREATE INDEX idx_article_reports_created ON article_reports(created_at DESC);
ALTER TABLE article_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read reports" ON article_reports FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create reports" ON article_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE comment_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate_speech', 'misinformation', 'inappropriate', 'other')),
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_comment_reports_comment ON comment_reports(comment_id);
CREATE INDEX idx_comment_reports_user ON comment_reports(user_id);
CREATE INDEX idx_comment_reports_status ON comment_reports(status);
CREATE INDEX idx_comment_reports_created ON comment_reports(created_at DESC);
ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read comment reports" ON comment_reports FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create comment reports" ON comment_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TABLE ad_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    position TEXT NOT NULL CHECK (position IN ('article_top', 'article_middle', 'article_bottom', 'sidebar_top', 'sidebar_middle', 'sidebar_bottom', 'list_top', 'list_inline')),
    ad_code TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    conditions JSONB DEFAULT '{}'::jsonb,
    list_interval INTEGER,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ad_placements_position ON ad_placements(position);
CREATE INDEX idx_ad_placements_enabled ON ad_placements(enabled);
CREATE INDEX idx_ad_placements_priority ON ad_placements(priority DESC);
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read enabled ads" ON ad_placements FOR SELECT USING (enabled = true);

-- ============================================================================
-- 5. Admin System
-- ============================================================================

CREATE TABLE admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_expires_at ON admin_sessions(expires_at);
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own sessions" ON admin_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id TEXT,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_user_id ON admin_audit_log(user_id);
CREATE INDEX idx_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_audit_log_resource ON admin_audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_log_created_at ON admin_audit_log(created_at DESC);
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view audit log" ON admin_audit_log FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = TRUE));

CREATE TABLE admin_login_attempts (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    ip_address INET NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_login_attempts_email ON admin_login_attempts(email, created_at DESC);
CREATE INDEX idx_login_attempts_ip ON admin_login_attempts(ip_address, created_at DESC);
CREATE INDEX idx_login_attempts_created_at ON admin_login_attempts(created_at);
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role can access login attempts" ON admin_login_attempts FOR ALL USING (false);

-- ============================================================================
-- 6. Social Media
-- ============================================================================

CREATE TABLE social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id CHAR(7) NOT NULL REFERENCES generated_articles(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads')),
    content TEXT NOT NULL,
    article_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'posted', 'failed')),
    posted_at TIMESTAMPTZ,
    post_url TEXT,
    error_message TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_social_posts_article_id ON social_posts(article_id);
CREATE INDEX idx_social_posts_platform ON social_posts(platform);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX idx_social_posts_pending ON social_posts(status, created_at DESC) WHERE status = 'pending';
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read social posts" ON social_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create social posts" ON social_posts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update social posts" ON social_posts FOR UPDATE TO authenticated USING (true);

CREATE TABLE meta_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'threads')),
    access_token TEXT NOT NULL,
    page_id TEXT,
    instagram_account_id TEXT,
    threads_user_id TEXT,
    token_expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_active_platform UNIQUE (platform, is_active)
);
CREATE INDEX idx_meta_credentials_platform ON meta_credentials(platform);
CREATE INDEX idx_meta_credentials_active ON meta_credentials(is_active, platform);
ALTER TABLE meta_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read meta credentials" ON meta_credentials FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage meta credentials" ON meta_credentials FOR ALL TO authenticated USING (true);

-- ============================================================================
-- 7. Functions & Triggers
-- ============================================================================

-- Auto cleanup expired articles
CREATE OR REPLACE FUNCTION cleanup_expired_articles() RETURNS void AS $$
BEGIN DELETE FROM raw_articles WHERE expires_at < NOW(); END;
$$ LANGUAGE plpgsql;

-- Auto cleanup old locks
CREATE OR REPLACE FUNCTION cleanup_old_locks() RETURNS void AS $$
BEGIN DELETE FROM daily_topic_locks WHERE date < CURRENT_DATE - INTERVAL '7 days'; END;
$$ LANGUAGE plpgsql;

-- Set published_at on publish
CREATE OR REPLACE FUNCTION set_published_at() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.published = true AND (OLD IS NULL OR OLD.published = false) THEN
        NEW.published_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_set_published_at BEFORE INSERT OR UPDATE ON generated_articles FOR EACH ROW EXECUTE FUNCTION set_published_at();

-- Share count trigger (legacy)
CREATE OR REPLACE FUNCTION increment_share_count() RETURNS TRIGGER AS $$
BEGIN
    UPDATE generated_articles SET share_count = share_count + 1 WHERE id = NEW.article_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_increment_share AFTER INSERT ON share_events FOR EACH ROW EXECUTE FUNCTION increment_share_count();

-- Auto create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, display_name, avatar_url)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.raw_user_meta_data->>'avatar_url');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Favorites count trigger
CREATE OR REPLACE FUNCTION update_article_favorites_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE generated_articles SET favorites_count = favorites_count + 1 WHERE id = NEW.article_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE generated_articles SET favorites_count = GREATEST(0, favorites_count - 1) WHERE id = OLD.article_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_favorites_count AFTER INSERT OR DELETE ON user_favorites FOR EACH ROW EXECUTE FUNCTION update_article_favorites_count();

-- Comments count trigger (race-condition-safe)
CREATE OR REPLACE FUNCTION update_article_comments_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        DECLARE target_article_id TEXT;
        BEGIN
            IF TG_OP = 'DELETE' THEN target_article_id := OLD.article_id;
            ELSE target_article_id := NEW.article_id;
            END IF;
            UPDATE generated_articles SET comments_count = (SELECT COUNT(*) FROM comments WHERE article_id = target_article_id AND is_approved = true) WHERE id = target_article_id;
        END;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_comments_count AFTER INSERT OR UPDATE OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION update_article_comments_count();

-- Comment likes count trigger
CREATE OR REPLACE FUNCTION update_comment_likes_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE comments SET likes_count = likes_count + 1 WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE comments SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_comment_likes_count AFTER INSERT OR DELETE ON comment_likes FOR EACH ROW EXECUTE FUNCTION update_comment_likes_count();

-- Article likes count trigger
CREATE OR REPLACE FUNCTION update_article_likes_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE generated_articles SET likes_count = likes_count + 1 WHERE id = NEW.article_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE generated_articles SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.article_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_article_likes_count AFTER INSERT OR DELETE ON article_likes FOR EACH ROW EXECUTE FUNCTION update_article_likes_count();

-- Article share count trigger
CREATE OR REPLACE FUNCTION update_article_share_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE generated_articles SET share_count = share_count + 1 WHERE id = NEW.article_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_update_article_share_count AFTER INSERT ON article_shares FOR EACH ROW EXECUTE FUNCTION update_article_share_count();

-- Updated_at triggers for reports and social
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_article_reports_updated_at BEFORE UPDATE ON article_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_comment_reports_updated_at BEFORE UPDATE ON comment_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_ad_placements_updated_at BEFORE UPDATE ON ad_placements FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER social_posts_updated_at_trigger BEFORE UPDATE ON social_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER meta_credentials_updated_at_trigger BEFORE UPDATE ON meta_credentials FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Atomic view count increment
CREATE OR REPLACE FUNCTION increment_view_count(article_id TEXT) RETURNS VOID AS $$
BEGIN
    UPDATE generated_articles SET view_count = COALESCE(view_count, 0) + 1 WHERE id = article_id AND published = true;
END;
$$ LANGUAGE plpgsql VOLATILE;
GRANT EXECUTE ON FUNCTION increment_view_count TO anon, authenticated;

-- Statistics functions
CREATE OR REPLACE FUNCTION get_article_favorites_count(article_id_param TEXT) RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM user_favorites WHERE article_id = article_id_param;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION get_article_comments_count(article_id_param TEXT) RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM comments WHERE article_id = article_id_param AND is_approved = true;
$$ LANGUAGE sql STABLE;

-- Popular tags function
CREATE OR REPLACE FUNCTION get_popular_tags(tag_limit INT DEFAULT 30) RETURNS TABLE (name TEXT, count BIGINT) AS $$
    SELECT tag as name, COUNT(*) as count
    FROM generated_articles, jsonb_array_elements_text(tags) as tag
    WHERE published = true AND tags IS NOT NULL
    GROUP BY tag ORDER BY count DESC LIMIT tag_limit;
$$ LANGUAGE SQL STABLE;

-- Search function
CREATE OR REPLACE FUNCTION search_articles(search_query TEXT, result_limit INT DEFAULT 30)
RETURNS TABLE (id character(7), title_zh TEXT, content_zh TEXT, published_at TIMESTAMPTZ, cover_image TEXT, categories TEXT[], rank REAL) AS $$
BEGIN
    RETURN QUERY
    SELECT ga.id::character(7), ga.title_zh, ga.content_zh, ga.published_at, ga.cover_image, ga.categories,
        (ts_rank(to_tsvector('simple', coalesce(ga.title_zh, '') || ' ' || coalesce(ga.content_zh, '')), plainto_tsquery('simple', search_query))
        + ts_rank(to_tsvector('simple', coalesce(ga.title_zh, '')), plainto_tsquery('simple', search_query)) * 2)::REAL AS rank
    FROM generated_articles ga
    WHERE ga.published = true
        AND to_tsvector('simple', coalesce(ga.title_zh, '') || ' ' || coalesce(ga.content_zh, '')) @@ plainto_tsquery('simple', search_query)
    ORDER BY rank DESC, ga.published_at DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql STABLE;
GRANT EXECUTE ON FUNCTION search_articles TO anon, authenticated;

-- Admin helper functions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions() RETURNS void AS $$
BEGIN DELETE FROM admin_sessions WHERE expires_at < NOW(); END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_login_rate_limit(p_email TEXT, p_ip_address INET) RETURNS BOOLEAN AS $$
DECLARE failed_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO failed_count FROM admin_login_attempts
    WHERE (email = p_email OR ip_address = p_ip_address) AND success = FALSE AND created_at > NOW() - INTERVAL '15 minutes';
    RETURN failed_count < 5;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_login_attempts() RETURNS void AS $$
BEGIN DELETE FROM admin_login_attempts WHERE created_at < NOW() - INTERVAL '30 days'; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION log_admin_action(p_user_id UUID, p_user_email TEXT, p_action VARCHAR(50), p_resource_type VARCHAR(50) DEFAULT NULL, p_resource_id TEXT DEFAULT NULL, p_changes JSONB DEFAULT NULL, p_ip_address INET DEFAULT NULL, p_user_agent TEXT DEFAULT NULL) RETURNS void AS $$
BEGIN
    INSERT INTO admin_audit_log (user_id, user_email, action, resource_type, resource_id, changes, ip_address, user_agent)
    VALUES (p_user_id, p_user_email, p_action, p_resource_type, p_resource_id, p_changes, p_ip_address, p_user_agent);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Views
-- ============================================================================

CREATE VIEW published_articles AS
SELECT id, title_zh, content_zh, slug_en, source_urls, published_at, view_count, share_count, created_at
FROM generated_articles WHERE published = true ORDER BY published_at DESC, created_at DESC;

CREATE VIEW tag_statistics AS
SELECT unnest(brands) as brand, COUNT(*) as article_count
FROM generated_articles WHERE published = true AND brands IS NOT NULL GROUP BY brand ORDER BY article_count DESC;

CREATE VIEW popular_tags AS
SELECT jsonb_array_elements_text(tags) as tag, COUNT(*) as usage_count
FROM generated_articles WHERE published = true GROUP BY tag ORDER BY usage_count DESC LIMIT 50;

CREATE OR REPLACE VIEW active_admin_sessions AS
SELECT s.id, s.user_id, u.email, s.ip_address, s.created_at, s.expires_at, s.last_activity_at,
    EXTRACT(EPOCH FROM (s.expires_at - NOW())) / 3600 AS hours_until_expiry
FROM admin_sessions s JOIN auth.users u ON s.user_id = u.id
WHERE s.expires_at > NOW() ORDER BY s.last_activity_at DESC;

-- ============================================================================
-- 9. Initial Data
-- ============================================================================

INSERT INTO style_configs (version, system_prompt, style_guide, active) VALUES (
    'v1.0',
    '# 角色定義\n你是一位資深汽車產業媒體人，擁有15年從業經驗。',
    '# 文章結構模板\n參見 style-guide.txt',
    true
);

-- ============================================================================
-- DONE! Next step: Set your admin user
-- UPDATE profiles SET is_admin = TRUE WHERE id = 'YOUR_USER_UUID';
-- ============================================================================
