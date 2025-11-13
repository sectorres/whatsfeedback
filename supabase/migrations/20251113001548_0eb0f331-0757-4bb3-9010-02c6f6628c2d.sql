-- Adicionar campo tags na tabela conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT ARRAY[]::text[];