-- Adicionar 'location' como tipo válido de mídia nas mensagens
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_media_type_check;

ALTER TABLE public.messages ADD CONSTRAINT messages_media_type_check 
CHECK (media_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location'));