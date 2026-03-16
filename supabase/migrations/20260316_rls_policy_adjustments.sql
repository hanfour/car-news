-- RLS Policy 調整：讓 RLS client 能正確存取自己的未審核內容和私人車友會
-- 這些調整向後相容，service role client 忽略 RLS，部署不影響現有行為。

-- forum_posts: 用戶可以看到自己的未審核貼文
DROP POLICY IF EXISTS "Forum posts are viewable by everyone" ON forum_posts;
CREATE POLICY "Forum posts are viewable by everyone" ON forum_posts
  FOR SELECT USING (is_approved = true OR auth.uid() = user_id);

-- forum_replies: 用戶可以看到自己的未審核回覆
DROP POLICY IF EXISTS "Forum replies are viewable by everyone" ON forum_replies;
CREATE POLICY "Forum replies are viewable by everyone" ON forum_replies
  FOR SELECT USING (is_approved = true OR auth.uid() = user_id);

-- car_clubs: 成員和 owner 可以看到私人車友會
DROP POLICY IF EXISTS "Public clubs are viewable by everyone" ON car_clubs;
CREATE POLICY "Public clubs are viewable by everyone" ON car_clubs
  FOR SELECT USING (
    is_public = true
    OR auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM club_members
      WHERE club_members.club_id = car_clubs.id
        AND club_members.user_id = auth.uid()
    )
  );
