-- Add push_token column to profiles table
-- Stores the Expo push token for each user so the server can send targeted notifications.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Index for efficient token lookups by operators sending alerts
CREATE INDEX IF NOT EXISTS idx_profiles_push_token
  ON profiles (push_token)
  WHERE push_token IS NOT NULL;

-- Allow users to update their own push token
CREATE POLICY "Users can update own push token"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
