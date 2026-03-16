-- Phase 3: 追蹤/關注系統

-- 使用者追蹤
CREATE TABLE user_follows (
    follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX idx_user_follows_following ON user_follows(following_id);
CREATE INDEX idx_user_follows_created ON user_follows(created_at DESC);

ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User follows are viewable by everyone" ON user_follows FOR SELECT USING (true);
CREATE POLICY "Authenticated users can follow" ON user_follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON user_follows FOR DELETE USING (auth.uid() = follower_id);

-- 主題追蹤
CREATE TABLE topic_follows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    topic_type TEXT NOT NULL CHECK (topic_type IN ('brand', 'car_model', 'category')),
    topic_value TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, topic_type, topic_value)
);

CREATE INDEX idx_topic_follows_user ON topic_follows(user_id);
CREATE INDEX idx_topic_follows_topic ON topic_follows(topic_type, topic_value);

ALTER TABLE topic_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Topic follows are viewable by everyone" ON topic_follows FOR SELECT USING (true);
CREATE POLICY "Users can follow topics" ON topic_follows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow topics" ON topic_follows FOR DELETE USING (auth.uid() = user_id);

-- profiles 追蹤計數欄位
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS followers_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS following_count INTEGER DEFAULT 0;

-- Trigger: 維護 follow 計數
CREATE OR REPLACE FUNCTION update_follow_counts() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
        UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
        UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_follow_counts
    AFTER INSERT OR DELETE ON user_follows
    FOR EACH ROW
    EXECUTE FUNCTION update_follow_counts();

-- Trigger: 新追蹤者通知
CREATE OR REPLACE FUNCTION notify_new_follower() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (recipient_id, actor_id, type, resource_type, resource_id)
    VALUES (NEW.following_id, NEW.follower_id, 'new_follower', 'user', NEW.follower_id::TEXT);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_new_follower
    AFTER INSERT ON user_follows
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_follower();
