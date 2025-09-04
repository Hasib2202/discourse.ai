-- Fix RLS Policies and Add Helper Functions
-- Run this in your Supabase SQL editor

-- First, let's fix the problematic RLS policy for participants
DROP POLICY IF EXISTS "Users can view participants in rooms they joined" ON participants;

-- Create a better policy that doesn't cause recursion
CREATE POLICY "Users can view participants in rooms they joined" ON participants
    FOR SELECT USING (
        -- Allow viewing if user is the participant themselves
        auth.uid() = user_id 
        OR
        -- Or if the room is public (not private)
        EXISTS (
            SELECT 1 FROM rooms r 
            WHERE r.id = participants.room_id 
            AND r.is_private = false
        )
        OR
        -- Or if user is the host of the room
        EXISTS (
            SELECT 1 FROM rooms r 
            WHERE r.id = participants.room_id 
            AND r.host_id = auth.uid()
        )
    );

-- Create RPC function to get room participants with profiles
CREATE OR REPLACE FUNCTION get_room_participants(room_id_param UUID)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    user_id UUID,
    role participant_role,
    status participant_status,
    joined_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    is_online BOOLEAN,
    profiles JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.room_id,
        p.user_id,
        p.role,
        p.status,
        p.joined_at,
        p.ready_at,
        p.left_at,
        p.is_online,
        jsonb_build_object(
            'id', pr.id,
            'full_name', pr.full_name,
            'avatar_url', pr.avatar_url
        ) as profiles
    FROM participants p
    LEFT JOIN profiles pr ON p.user_id = pr.id
    WHERE p.room_id = room_id_param
    ORDER BY p.joined_at ASC;
END;
$$;

-- Create RPC function to get room messages with profiles
CREATE OR REPLACE FUNCTION get_room_messages(room_id_param UUID)
RETURNS TABLE (
    id UUID,
    room_id UUID,
    user_id UUID,
    content TEXT,
    message_type VARCHAR(20),
    created_at TIMESTAMPTZ,
    profiles JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.room_id,
        m.user_id,
        m.content,
        m.message_type,
        m.created_at,
        jsonb_build_object(
            'id', pr.id,
            'full_name', pr.full_name,
            'avatar_url', pr.avatar_url
        ) as profiles
    FROM messages m
    LEFT JOIN profiles pr ON m.user_id = pr.id
    WHERE m.room_id = room_id_param
    ORDER BY m.created_at ASC
    LIMIT 50;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_room_participants(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_room_messages(UUID) TO authenticated;
