-- Criar tabela para pesquisas de satisfação
CREATE TABLE IF NOT EXISTS public.satisfaction_surveys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_send_id UUID NOT NULL REFERENCES campaign_sends(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.satisfaction_surveys ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso total
CREATE POLICY "Allow all access to satisfaction_surveys"
ON public.satisfaction_surveys
FOR ALL
USING (true)
WITH CHECK (true);

-- Criar índices para melhor performance
CREATE INDEX idx_satisfaction_surveys_campaign_send_id ON public.satisfaction_surveys(campaign_send_id);
CREATE INDEX idx_satisfaction_surveys_status ON public.satisfaction_surveys(status);
CREATE INDEX idx_satisfaction_surveys_sent_at ON public.satisfaction_surveys(sent_at);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_satisfaction_surveys_updated_at
BEFORE UPDATE ON public.satisfaction_surveys
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Tabela para insights gerados por IA
CREATE TABLE IF NOT EXISTS public.satisfaction_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  total_responses INTEGER NOT NULL DEFAULT 0,
  average_rating DECIMAL(3,2),
  rating_distribution JSONB,
  insights TEXT,
  sentiment_summary TEXT,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.satisfaction_insights ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso total
CREATE POLICY "Allow all access to satisfaction_insights"
ON public.satisfaction_insights
FOR ALL
USING (true)
WITH CHECK (true);

-- Criar índice
CREATE INDEX idx_satisfaction_insights_campaign_id ON public.satisfaction_insights(campaign_id);