-- Create table to track automatic template sends (prevent duplicates)
CREATE TABLE public.automatic_template_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_numero TEXT NOT NULL,
  pedido_id INTEGER NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  status_triggered TEXT NOT NULL, -- 'ABER' or 'FATU'
  template_sent TEXT NOT NULL,
  data_pedido TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pedido_numero, status_triggered)
);

-- Enable RLS
ALTER TABLE public.automatic_template_sends ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read automatic_template_sends"
ON public.automatic_template_sends FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert automatic_template_sends"
ON public.automatic_template_sends FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete automatic_template_sends"
ON public.automatic_template_sends FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Add index for faster lookups
CREATE INDEX idx_automatic_template_sends_pedido ON public.automatic_template_sends(pedido_numero, status_triggered);