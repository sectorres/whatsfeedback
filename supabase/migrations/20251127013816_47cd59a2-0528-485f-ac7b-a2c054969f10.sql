-- Add profile_picture_url column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_conversations_profile_picture 
ON public.conversations(profile_picture_url) 
WHERE profile_picture_url IS NOT NULL;