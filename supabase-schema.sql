-- Supabase Database Schema for Discourse Debate Platform

-- Create ENUM types
CREATE TYPE debate_mode AS ENUM ('classic', 'corporate', 'interactive');
CREATE TYPE room_status AS ENUM ('waiting', 'active', 'completed');
CREATE TYPE participant_role AS ENUM ('host', 'debater', 'audience');
CREATE TYPE participant_status AS ENUM ('joined', 'ready', 'speaking', 'muted');

-- Rooms Table
CREATE TABLE rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    topic TEXT NOT NULL,
    description TEXT,
    mode debate_mode NOT NULL DEFAULT 'classic',
    status room_status NOT NULL DEFAULT 'waiting',
    max_participants INTEGER NOT NULL DEFAULT 10,
    current_participants INTEGER NOT NULL DEFAULT 0,
    host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    room_code VARCHAR(10) UNIQUE NOT NULL,
    is_private BOOLEAN DEFAULT false,
    settings JSONB DEFAULT '{}',
    
    -- Debate specific settings
    debate_duration INTEGER DEFAULT 1800, -- 30 minutes in seconds
    turn_duration INTEGER DEFAULT 120,    -- 2 minutes per turn in seconds
    rounds_count INTEGER DEFAULT 3
);

-- Participants Table
CREATE TABLE participants (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role participant_role NOT NULL DEFAULT 'audience',
    status participant_status NOT NULL DEFAULT 'joined',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ready_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    is_online BOOLEAN DEFAULT true,
    
    -- Unique constraint to prevent duplicate participants
    UNIQUE(room_id, user_id)
);

-- User Profiles Table (extend Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Debate stats
    total_debates INTEGER DEFAULT 0,
    debates_won INTEGER DEFAULT 0,
    total_speaking_time INTEGER DEFAULT 0, -- in seconds
    average_rating DECIMAL(3,2) DEFAULT 0.00
);

-- Messages Table (for lobby chat)
CREATE TABLE messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'system', 'notification'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_rooms_host_id ON rooms(host_id);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_mode ON rooms(mode);
CREATE INDEX idx_rooms_created_at ON rooms(created_at DESC);
CREATE INDEX idx_participants_room_id ON participants(room_id);
CREATE INDEX idx_participants_user_id ON participants(user_id);
CREATE INDEX idx_participants_status ON participants(status);
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- Functions to generate room codes
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..6 LOOP
        result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Trigger to generate room code
CREATE OR REPLACE FUNCTION set_room_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.room_code IS NULL THEN
        NEW.room_code := generate_room_code();
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM rooms WHERE room_code = NEW.room_code) LOOP
            NEW.room_code := generate_room_code();
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_room_code
    BEFORE INSERT ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION set_room_code();

-- Trigger to update participant count
CREATE OR REPLACE FUNCTION update_room_participant_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE rooms 
        SET current_participants = current_participants + 1,
            updated_at = NOW()
        WHERE id = NEW.room_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE rooms 
        SET current_participants = current_participants - 1,
            updated_at = NOW()
        WHERE id = OLD.room_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_participant_count
    AFTER INSERT OR DELETE ON participants
    FOR EACH ROW
    EXECUTE FUNCTION update_room_participant_count();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security (RLS) Policies

-- Rooms policies
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all rooms" ON rooms
    FOR SELECT USING (true);

CREATE POLICY "Users can create rooms" ON rooms
    FOR INSERT WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Host can update their rooms" ON rooms
    FOR UPDATE USING (auth.uid() = host_id);

CREATE POLICY "Host can delete their rooms" ON rooms
    FOR DELETE USING (auth.uid() = host_id);

-- Participants policies
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view participants in rooms they joined" ON participants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM participants p2 
            WHERE p2.room_id = participants.room_id 
            AND p2.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can join rooms" ON participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participation" ON participants
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms" ON participants
    FOR DELETE USING (auth.uid() = user_id);

-- Profiles policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Messages policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in rooms they joined" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM participants p 
            WHERE p.room_id = messages.room_id 
            AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can send messages in rooms they joined" ON messages
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM participants p 
            WHERE p.room_id = messages.room_id 
            AND p.user_id = auth.uid()
        )
    );

-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;