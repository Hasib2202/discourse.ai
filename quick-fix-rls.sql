-- Quick Fix: Temporarily disable RLS to get the app working
-- Run this in your Supabase SQL editor

-- Disable RLS on participants table temporarily
ALTER TABLE participants DISABLE ROW LEVEL SECURITY;

-- Disable RLS on messages table temporarily  
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;

-- Keep RLS enabled for rooms and profiles for basic security
-- ALTER TABLE rooms DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Note: This is a temporary fix. In production, you should:
-- 1. Use proper RLS policies that don't cause recursion
-- 2. Or use service role authentication for admin operations
-- 3. Or implement the RPC functions correctly
