-- Phase 2: 通知系統

-- 通知表
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN (
        'comment_reply', 'comment_like', 'new_follower',
        'followed_comment', 'forum_reply', 'car_club_post', 'system'
    )),
    resource_type TEXT,
    resource_id TEXT,
    body TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_actor ON notifications(actor_id);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

-- 通知設定表
CREATE TABLE notification_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    comment_reply BOOLEAN DEFAULT true,
    comment_like BOOLEAN DEFAULT true,
    new_follower BOOLEAN DEFAULT true,
    followed_activity BOOLEAN DEFAULT true,
    forum_reply BOOLEAN DEFAULT true,
    car_club_post BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notification settings" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notification settings" ON notification_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification settings" ON notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger: 評論回覆通知
CREATE OR REPLACE FUNCTION notify_comment_reply() RETURNS TRIGGER AS $$
DECLARE
    parent_user_id UUID;
BEGIN
    -- 只對有 parent_id 的回覆觸發
    IF NEW.parent_id IS NOT NULL THEN
        SELECT user_id INTO parent_user_id FROM comments WHERE id = NEW.parent_id;

        -- 不通知自己
        IF parent_user_id IS NOT NULL AND parent_user_id != NEW.user_id THEN
            INSERT INTO notifications (recipient_id, actor_id, type, resource_type, resource_id, body, metadata)
            VALUES (
                parent_user_id,
                NEW.user_id,
                'comment_reply',
                'comment',
                NEW.id::TEXT,
                LEFT(NEW.content, 100),
                jsonb_build_object('article_id', NEW.article_id, 'parent_comment_id', NEW.parent_id)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_comment_reply
    AFTER INSERT ON comments
    FOR EACH ROW
    EXECUTE FUNCTION notify_comment_reply();

-- Trigger: 評論按讚通知
CREATE OR REPLACE FUNCTION notify_comment_like() RETURNS TRIGGER AS $$
DECLARE
    comment_user_id UUID;
    comment_content TEXT;
    comment_article_id TEXT;
BEGIN
    SELECT user_id, LEFT(content, 100), article_id
    INTO comment_user_id, comment_content, comment_article_id
    FROM comments WHERE id = NEW.comment_id;

    -- 不通知自己
    IF comment_user_id IS NOT NULL AND comment_user_id != NEW.user_id THEN
        INSERT INTO notifications (recipient_id, actor_id, type, resource_type, resource_id, body, metadata)
        VALUES (
            comment_user_id,
            NEW.user_id,
            'comment_like',
            'comment',
            NEW.comment_id::TEXT,
            comment_content,
            jsonb_build_object('article_id', comment_article_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_comment_like
    AFTER INSERT ON comment_likes
    FOR EACH ROW
    EXECUTE FUNCTION notify_comment_like();
