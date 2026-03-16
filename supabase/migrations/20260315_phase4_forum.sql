-- Phase 4: 討論區/論壇

CREATE TABLE forum_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    post_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE forum_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum categories are viewable by everyone" ON forum_categories FOR SELECT USING (true);

-- 預設分類
INSERT INTO forum_categories (name, slug, description, icon, sort_order) VALUES
    ('購車諮詢', 'buying-advice', '買車前的疑問和建議', '🚗', 1),
    ('車款討論', 'car-models', '各車款的討論與比較', '🔍', 2),
    ('維修保養', 'maintenance', '車輛保養與維修經驗分享', '🔧', 3),
    ('改裝升級', 'modifications', '改裝、升級、配件討論', '⚡', 4),
    ('用車生活', 'car-life', '自駕遊、日常用車心得', '🛣️', 5),
    ('閒聊灌水', 'general', '輕鬆聊天、車界八卦', '💬', 6);

CREATE TABLE forum_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES forum_categories(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT true,
    view_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    last_reply_at TIMESTAMPTZ,
    last_reply_by UUID,
    tags TEXT[] DEFAULT '{}',
    related_brand TEXT,
    related_model TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forum_posts_category ON forum_posts(category_id, created_at DESC);
CREATE INDEX idx_forum_posts_user ON forum_posts(user_id);
CREATE INDEX idx_forum_posts_pinned ON forum_posts(is_pinned, created_at DESC);
CREATE INDEX idx_forum_posts_last_reply ON forum_posts(last_reply_at DESC NULLS LAST);
CREATE INDEX idx_forum_posts_brand ON forum_posts(related_brand) WHERE related_brand IS NOT NULL;

ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum posts are viewable by everyone" ON forum_posts FOR SELECT USING (is_approved = true);
CREATE POLICY "Authenticated users can create posts" ON forum_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON forum_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON forum_posts FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE forum_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES forum_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    parent_id UUID REFERENCES forum_replies(id),
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT true,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_forum_replies_post ON forum_replies(post_id, created_at);
CREATE INDEX idx_forum_replies_user ON forum_replies(user_id);
CREATE INDEX idx_forum_replies_parent ON forum_replies(parent_id);

ALTER TABLE forum_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum replies are viewable by everyone" ON forum_replies FOR SELECT USING (is_approved = true);
CREATE POLICY "Authenticated users can create replies" ON forum_replies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own replies" ON forum_replies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own replies" ON forum_replies FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE forum_likes (
    user_id UUID NOT NULL REFERENCES auth.users(id),
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'reply')),
    target_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, target_type, target_id)
);

ALTER TABLE forum_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Forum likes are viewable by everyone" ON forum_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON forum_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove own likes" ON forum_likes FOR DELETE USING (auth.uid() = user_id);

-- Trigger: 更新 reply_count 和 last_reply
CREATE OR REPLACE FUNCTION update_forum_post_reply_stats() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE forum_posts SET
            reply_count = reply_count + 1,
            last_reply_at = NEW.created_at,
            last_reply_by = NEW.user_id
        WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE forum_posts SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_forum_reply_stats
    AFTER INSERT OR DELETE ON forum_replies
    FOR EACH ROW EXECUTE FUNCTION update_forum_post_reply_stats();

-- Trigger: 更新 forum_categories.post_count
CREATE OR REPLACE FUNCTION update_forum_category_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE forum_categories SET post_count = post_count + 1 WHERE id = NEW.category_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE forum_categories SET post_count = GREATEST(0, post_count - 1) WHERE id = OLD.category_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_forum_category_count
    AFTER INSERT OR DELETE ON forum_posts
    FOR EACH ROW EXECUTE FUNCTION update_forum_category_count();

-- Trigger: forum like counts
CREATE OR REPLACE FUNCTION update_forum_like_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.target_type = 'post' THEN
            UPDATE forum_posts SET like_count = like_count + 1 WHERE id = NEW.target_id;
        ELSE
            UPDATE forum_replies SET like_count = like_count + 1 WHERE id = NEW.target_id;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.target_type = 'post' THEN
            UPDATE forum_posts SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.target_id;
        ELSE
            UPDATE forum_replies SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.target_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_forum_like_count
    AFTER INSERT OR DELETE ON forum_likes
    FOR EACH ROW EXECUTE FUNCTION update_forum_like_count();

-- Trigger: 論壇回覆通知
CREATE OR REPLACE FUNCTION notify_forum_reply() RETURNS TRIGGER AS $$
DECLARE
    post_user_id UUID;
    post_title TEXT;
BEGIN
    SELECT user_id, title INTO post_user_id, post_title FROM forum_posts WHERE id = NEW.post_id;

    IF post_user_id IS NOT NULL AND post_user_id != NEW.user_id THEN
        INSERT INTO notifications (recipient_id, actor_id, type, resource_type, resource_id, body, metadata)
        VALUES (
            post_user_id, NEW.user_id, 'forum_reply', 'forum_post', NEW.post_id::TEXT,
            LEFT(NEW.content, 100),
            jsonb_build_object('post_title', post_title)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_forum_reply
    AFTER INSERT ON forum_replies
    FOR EACH ROW EXECUTE FUNCTION notify_forum_reply();
