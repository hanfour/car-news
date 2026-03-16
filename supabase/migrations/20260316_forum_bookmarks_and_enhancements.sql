-- Forum Bookmarks
CREATE TABLE IF NOT EXISTS forum_bookmarks (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Add bookmark_count to forum_posts
ALTER TABLE forum_posts ADD COLUMN IF NOT EXISTS bookmark_count INTEGER DEFAULT 0;

-- Car club enhancements
ALTER TABLE car_clubs ADD COLUMN IF NOT EXISTS rules TEXT;
ALTER TABLE car_clubs ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

-- User profile enhancements
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS forum_post_count INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS car_count INTEGER DEFAULT 0;

-- User blocks
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_id != blocked_id)
);

-- Reports
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id),
  target_type TEXT CHECK (target_type IN ('forum_post', 'forum_reply', 'club_post', 'user', 'comment')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atomic increment function for view_count
CREATE OR REPLACE FUNCTION increment_view_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE forum_posts SET view_count = view_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic increment/decrement for bookmark_count
CREATE OR REPLACE FUNCTION update_bookmark_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE forum_posts SET bookmark_count = bookmark_count + 1 WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE forum_posts SET bookmark_count = GREATEST(0, bookmark_count - 1) WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_bookmark_count
  AFTER INSERT OR DELETE ON forum_bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_bookmark_count();

-- Prevent duplicate reports from same user on same target
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_unique_per_user
  ON reports (reporter_id, target_type, target_id)
  WHERE status = 'pending';

-- RLS policies for forum_bookmarks
ALTER TABLE forum_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookmarks" ON forum_bookmarks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookmarks" ON forum_bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookmarks" ON forum_bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for user_blocks
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own blocks" ON user_blocks
  FOR ALL USING (auth.uid() = blocker_id);

-- RLS policies for reports
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);
