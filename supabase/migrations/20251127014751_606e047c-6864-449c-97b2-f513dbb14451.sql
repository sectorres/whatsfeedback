-- Adicionar coluna whatsapp_message_id para armazenar o ID da mensagem no WhatsApp
ALTER TABLE public.messages 
ADD COLUMN whatsapp_message_id TEXT;

-- Criar índice para buscar mensagens pelo whatsapp_message_id
CREATE INDEX idx_messages_whatsapp_message_id ON public.messages(whatsapp_message_id);

COMMENT ON COLUMN public.messages.whatsapp_message_id IS 'ID da mensagem no WhatsApp (key.id da Evolution API)';