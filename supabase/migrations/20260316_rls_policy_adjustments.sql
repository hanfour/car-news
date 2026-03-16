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
      SELECT 1 FROM car_club_members
      WHERE car_club_members.club_id = car_clubs.id
        AND car_club_members.user_id = auth.uid()
    )
  );

-- car_club_posts: 公開 club 的貼文任何人可看，私人 club 限成員
DROP POLICY IF EXISTS "Club posts are viewable by members" ON car_club_posts;
CREATE POLICY "Club posts are viewable by members or public" ON car_club_posts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM car_clubs
      WHERE car_clubs.id = car_club_posts.club_id
        AND car_clubs.is_public = true
    )
    OR EXISTS (
      SELECT 1 FROM car_club_members
      WHERE car_club_members.club_id = car_club_posts.club_id
        AND car_club_members.user_id = auth.uid()
        AND car_club_members.status = 'active'
    )
  );

-- user_favorites: 公開收藏頁可被任何人查看
DROP POLICY IF EXISTS "Users can view own favorites" ON user_favorites;
CREATE POLICY "Users can view favorites" ON user_favorites
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = user_favorites.user_id
        AND profiles.is_favorites_public = true
    )
  );
