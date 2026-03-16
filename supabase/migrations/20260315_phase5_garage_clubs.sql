-- Phase 5: 愛車資訊/車友會

-- 愛車表
CREATE TABLE user_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    trim_level TEXT,
    color TEXT,
    nickname TEXT,
    description TEXT,
    purchase_date DATE,
    mileage INTEGER,
    is_primary BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    cover_image TEXT,
    images JSONB DEFAULT '[]',
    specs JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_cars_user ON user_cars(user_id);
CREATE INDEX idx_user_cars_brand ON user_cars(brand);
CREATE INDEX idx_user_cars_public ON user_cars(is_public, created_at DESC) WHERE is_public = true;

ALTER TABLE user_cars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public cars are viewable by everyone" ON user_cars FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can manage own cars" ON user_cars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cars" ON user_cars FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cars" ON user_cars FOR DELETE USING (auth.uid() = user_id);

-- 車友會
CREATE TABLE car_clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    brand TEXT,
    model TEXT,
    cover_image TEXT,
    avatar_url TEXT,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    member_count INTEGER DEFAULT 1,
    post_count INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_car_clubs_slug ON car_clubs(slug);
CREATE INDEX idx_car_clubs_brand ON car_clubs(brand);
CREATE INDEX idx_car_clubs_owner ON car_clubs(owner_id);
CREATE INDEX idx_car_clubs_members ON car_clubs(member_count DESC);

ALTER TABLE car_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public clubs are viewable by everyone" ON car_clubs FOR SELECT USING (is_public = true);
CREATE POLICY "Authenticated users can create clubs" ON car_clubs FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update clubs" ON car_clubs FOR UPDATE USING (auth.uid() = owner_id);

-- 車友會成員
CREATE TABLE car_club_members (
    club_id UUID NOT NULL REFERENCES car_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    status TEXT DEFAULT 'active' CHECK (status IN ('pending', 'active', 'banned')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (club_id, user_id)
);

CREATE INDEX idx_club_members_user ON car_club_members(user_id);
CREATE INDEX idx_club_members_club ON car_club_members(club_id);

ALTER TABLE car_club_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club members are viewable by everyone" ON car_club_members FOR SELECT USING (true);
CREATE POLICY "Users can join clubs" ON car_club_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave clubs" ON car_club_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Club admins can manage members" ON car_club_members FOR UPDATE USING (
    EXISTS (SELECT 1 FROM car_club_members WHERE club_id = car_club_members.club_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- 車友會貼文
CREATE TABLE car_club_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES car_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    images JSONB DEFAULT '[]',
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_club_posts_club ON car_club_posts(club_id, created_at DESC);
CREATE INDEX idx_club_posts_user ON car_club_posts(user_id);

ALTER TABLE car_club_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club posts are viewable by members" ON car_club_posts FOR SELECT USING (
    EXISTS (SELECT 1 FROM car_club_members WHERE club_id = car_club_posts.club_id AND user_id = auth.uid() AND status = 'active')
    OR EXISTS (SELECT 1 FROM car_clubs WHERE id = car_club_posts.club_id AND is_public = true)
);
CREATE POLICY "Members can create posts" ON car_club_posts FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM car_club_members WHERE club_id = car_club_posts.club_id AND user_id = auth.uid() AND status = 'active')
);
CREATE POLICY "Users can update own posts" ON car_club_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON car_club_posts FOR DELETE USING (auth.uid() = user_id);

-- 車友會回覆
CREATE TABLE car_club_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES car_club_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_club_replies_post ON car_club_replies(post_id, created_at);

ALTER TABLE car_club_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Club replies are viewable" ON car_club_replies FOR SELECT USING (true);
CREATE POLICY "Members can reply" ON car_club_replies FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Trigger: member count
CREATE OR REPLACE FUNCTION update_club_member_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
        UPDATE car_clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
    ELSIF TG_OP = 'DELETE' AND OLD.status = 'active' THEN
        UPDATE car_clubs SET member_count = GREATEST(0, member_count - 1) WHERE id = OLD.club_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != 'active' AND NEW.status = 'active' THEN
            UPDATE car_clubs SET member_count = member_count + 1 WHERE id = NEW.club_id;
        ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
            UPDATE car_clubs SET member_count = GREATEST(0, member_count - 1) WHERE id = NEW.club_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_club_member_count
    AFTER INSERT OR DELETE OR UPDATE ON car_club_members
    FOR EACH ROW EXECUTE FUNCTION update_club_member_count();

-- Trigger: club post count
CREATE OR REPLACE FUNCTION update_club_post_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE car_clubs SET post_count = post_count + 1 WHERE id = NEW.club_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE car_clubs SET post_count = GREATEST(0, post_count - 1) WHERE id = OLD.club_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_club_post_count
    AFTER INSERT OR DELETE ON car_club_posts
    FOR EACH ROW EXECUTE FUNCTION update_club_post_count();

-- Trigger: club reply count
CREATE OR REPLACE FUNCTION update_club_reply_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE car_club_posts SET reply_count = reply_count + 1 WHERE id = NEW.post_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE car_club_posts SET reply_count = GREATEST(0, reply_count - 1) WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_club_reply_count
    AFTER INSERT OR DELETE ON car_club_replies
    FOR EACH ROW EXECUTE FUNCTION update_club_reply_count();
