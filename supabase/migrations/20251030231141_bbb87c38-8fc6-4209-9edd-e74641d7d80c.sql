-- Criar tabela para registrar cada envio individual de campanha
CREATE TABLE public.campaign_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_phone TEXT NOT NULL,
  message_sent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.campaign_sends ENABLE ROW LEVEL SECURITY;

-- Política de acesso total
CREATE POLICY "Allow all access to campaign_sends" 
ON public.campaign_sends 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Índice para buscar envios por campanha
CREATE INDEX idx_campaign_sends_campaign_id ON public.campaign_sends(campaign_id);

-- Índice para buscar envios por status
CREATE INDEX idx_campaign_sends_status ON public.campaign_sends(status);