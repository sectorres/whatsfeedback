-- Tabela para rastrear respostas de confirmação/reagendamento para evitar duplicatas
CREATE TABLE IF NOT EXISTS public.campaign_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  campaign_send_id uuid REFERENCES public.campaign_sends(id) ON DELETE SET NULL,
  response_type text NOT NULL CHECK (response_type IN ('confirmed', 'reschedule', 'wrong_number')),
  responded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para armazenar reagendamentos com datas
CREATE TABLE IF NOT EXISTS public.reschedules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  campaign_send_id uuid REFERENCES public.campaign_sends(id) ON DELETE SET NULL,
  customer_phone text NOT NULL,
  customer_name text,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  confirmed_at timestamp with time zone
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_campaign_responses_conversation ON public.campaign_responses(conversation_id);
CREATE INDEX IF NOT EXISTS idx_campaign_responses_campaign_send ON public.campaign_responses(campaign_send_id);
CREATE INDEX IF NOT EXISTS idx_reschedules_conversation ON public.reschedules(conversation_id);
CREATE INDEX IF NOT EXISTS idx_reschedules_status ON public.reschedules(status);
CREATE INDEX IF NOT EXISTS idx_reschedules_scheduled_date ON public.reschedules(scheduled_date);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_reschedules_updated_at
  BEFORE UPDATE ON public.reschedules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
ALTER TABLE public.campaign_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reschedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read campaign_responses"
  ON public.campaign_responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert campaign_responses"
  ON public.campaign_responses FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can read reschedules"
  ON public.reschedules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert reschedules"
  ON public.reschedules FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update reschedules"
  ON public.reschedules FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete reschedules"
  ON public.reschedules FOR DELETE
  TO authenticated
  USING (true);