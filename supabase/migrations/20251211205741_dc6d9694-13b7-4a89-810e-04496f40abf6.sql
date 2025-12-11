-- Add ai_active field to conversations table
ALTER TABLE public.conversations 
ADD COLUMN ai_active boolean DEFAULT true;

-- Add comment
COMMENT ON COLUMN public.conversations.ai_active IS 'Controls whether AI should respond to this conversation';

-- Update ai_config table to have proper structure for chat AI settings
-- Check if chat_ai_config exists, if not create the default record
INSERT INTO public.ai_config (config_key, prompt)
VALUES (
  'chat_ai',
  'Você é um assistente virtual de atendimento ao cliente de uma empresa de logística e entregas. Seja sempre cordial, profissional e objetivo. Ajude os clientes com informações sobre seus pedidos, entregas, e dúvidas gerais. Se não souber uma informação específica, oriente o cliente a aguardar o contato de um atendente humano.'
)
ON CONFLICT (config_key) DO NOTHING;