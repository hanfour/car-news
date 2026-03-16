-- Code review 修正：P1 + P2

-- P1: ad_placements admin ALL policy 補上 WITH CHECK
DROP POLICY IF EXISTS "Admins can manage ads" ON ad_placements;
CREATE POLICY "Admins can manage ads" ON ad_placements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- P2: car_club_replies INSERT 限制私人 club 只有成員可回覆
DROP POLICY IF EXISTS "Members can reply" ON car_club_replies;
CREATE POLICY "Members can reply to club posts" ON car_club_replies
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM car_club_posts
      JOIN car_club_members ON car_club_members.club_id = car_club_posts.club_id
      WHERE car_club_posts.id = car_club_replies.post_id
        AND car_club_members.user_id = auth.uid()
        AND car_club_members.status = 'active'
    )
  );
