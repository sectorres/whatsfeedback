-- Adicionar colunas para mídia nas mensagens
ALTER TABLE public.messages 
ADD COLUMN media_type TEXT CHECK (media_type IN ('text', 'audio', 'image', 'video', 'document')),
ADD COLUMN media_url TEXT,
ADD COLUMN media_transcription TEXT,
ADD COLUMN media_description TEXT;

-- Atualizar mensagens existentes para tipo text
UPDATE public.messages SET media_type = 'text' WHERE media_type IS NULL;