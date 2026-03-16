-- RLS 全面強化：修正審計發現的安全問題
-- CRITICAL / HIGH / MEDIUM 等級問題修正

-- ============================================================
-- CRITICAL: 為 9 張表啟用 RLS（僅允許 service_role 操作）
-- 這些表是後端系統表，不應被客戶端直接存取
-- ============================================================

-- generated_articles: 核心內容表，僅 service_role 可寫入
ALTER TABLE generated_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles are publicly readable" ON generated_articles
  FOR SELECT USING (true);
CREATE POLICY "Only service role can modify articles" ON generated_articles
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Only service role can update articles" ON generated_articles
  FOR UPDATE TO service_role USING (true);
CREATE POLICY "Only service role can delete articles" ON generated_articles
  FOR DELETE TO service_role USING (true);

-- style_configs: AI 系統 prompt，僅 service_role 可存取
ALTER TABLE style_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role can access style_configs" ON style_configs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- raw_articles: 爬蟲原始資料，僅 service_role
ALTER TABLE raw_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role can access raw_articles" ON raw_articles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- article_clusters: 文章聚合資料，僅 service_role
ALTER TABLE article_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role can access article_clusters" ON article_clusters
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- daily_topic_locks: 每日主題鎖定，僅 service_role
ALTER TABLE daily_topic_locks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role can access daily_topic_locks" ON daily_topic_locks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- cron_logs: 排程日誌，僅 service_role
ALTER TABLE cron_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role can access cron_logs" ON cron_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- image_experiments: 圖片實驗，僅 service_role
ALTER TABLE image_experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role can access image_experiments" ON image_experiments
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- image_experiment_samples: 圖片實驗樣本，僅 service_role
ALTER TABLE image_experiment_samples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only service role can access image_experiment_samples" ON image_experiment_samples
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- CRITICAL: meta_credentials — 限制只有 service_role 可存取
-- 目前任何已登入用戶都能讀取 OAuth tokens
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read meta credentials" ON meta_credentials;
DROP POLICY IF EXISTS "Authenticated users can manage meta credentials" ON meta_credentials;
CREATE POLICY "Only service role can access meta_credentials" ON meta_credentials
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- CRITICAL: social_posts — UPDATE 不應開放給所有已登入用戶
-- 限制為僅 service_role 可管理
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read social posts" ON social_posts;
DROP POLICY IF EXISTS "Authenticated users can create social posts" ON social_posts;
DROP POLICY IF EXISTS "Authenticated users can update social posts" ON social_posts;
CREATE POLICY "Only service role can manage social_posts" ON social_posts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- HIGH: 修正 admin 權限檢查 — 改用 profiles.is_admin
-- auth.jwt() -> 'user_metadata' 可被用戶自行設定，不安全
-- ============================================================

-- article_reports: 修正 admin UPDATE policy
DROP POLICY IF EXISTS "Admins can update reports" ON article_reports;
CREATE POLICY "Admins can update reports" ON article_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- article_reports: 限制 SELECT 只能看自己的檢舉或 admin 可看全部
DROP POLICY IF EXISTS "Anyone can read reports" ON article_reports;
CREATE POLICY "Users can view own or admin view all reports" ON article_reports
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- comment_reports: 修正 admin UPDATE policy
DROP POLICY IF EXISTS "Admins can update comment reports" ON comment_reports;
CREATE POLICY "Admins can update comment reports" ON comment_reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- comment_reports: 限制 SELECT
DROP POLICY IF EXISTS "Anyone can read comment reports" ON comment_reports;
CREATE POLICY "Users can view own or admin view all comment_reports" ON comment_reports
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ad_placements: 修正 admin ALL policy
DROP POLICY IF EXISTS "Admins can manage ads" ON ad_placements;
CREATE POLICY "Admins can manage ads" ON ad_placements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ============================================================
-- HIGH: car_club_members INSERT 要檢查 club 是否為私人
-- 私人 club 不允許直接加入（需透過 API 控制邀請流程）
-- ============================================================

DROP POLICY IF EXISTS "Users can join clubs" ON car_club_members;
CREATE POLICY "Users can join public clubs" ON car_club_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM car_clubs
      WHERE car_clubs.id = club_id
        AND car_clubs.is_public = true
    )
  );

-- ============================================================
-- MEDIUM: UPDATE policy 加上 WITH CHECK 防止 user_id 竄改
-- ============================================================

-- comments: 防止竄改 user_id
DROP POLICY IF EXISTS "Users can update own comments" ON comments;
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- forum_posts: 防止竄改 user_id
DROP POLICY IF EXISTS "Users can update own posts" ON forum_posts;
CREATE POLICY "Users can update own posts" ON forum_posts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- forum_replies: 防止竄改 user_id
DROP POLICY IF EXISTS "Users can update own replies" ON forum_replies;
CREATE POLICY "Users can update own replies" ON forum_replies
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_cars: 防止竄改 user_id
DROP POLICY IF EXISTS "Users can update own cars" ON user_cars;
CREATE POLICY "Users can update own cars" ON user_cars
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- car_club_posts: 防止竄改 user_id
DROP POLICY IF EXISTS "Users can update own posts" ON car_club_posts;
CREATE POLICY "Users can update own club posts" ON car_club_posts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- MEDIUM: car_club_replies SELECT — 限制私人 club 的回覆可見性
-- ============================================================

DROP POLICY IF EXISTS "Club replies are viewable" ON car_club_replies;
CREATE POLICY "Club replies follow club visibility" ON car_club_replies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM car_club_posts
      JOIN car_clubs ON car_clubs.id = car_club_posts.club_id
      WHERE car_club_posts.id = car_club_replies.post_id
        AND (
          car_clubs.is_public = true
          OR EXISTS (
            SELECT 1 FROM car_club_members
            WHERE car_club_members.club_id = car_clubs.id
              AND car_club_members.user_id = auth.uid()
              AND car_club_members.status = 'active'
          )
        )
    )
  );
