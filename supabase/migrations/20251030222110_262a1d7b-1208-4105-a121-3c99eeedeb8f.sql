-- Adicionar campo para rastrear conversas não lidas
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Adicionar campo para última mensagem não lida
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP WITH TIME ZONE;