-- Create table to store delivered orders for satisfaction surveys
CREATE TABLE IF NOT EXISTS public.delivered_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_numero text NOT NULL,
  pedido_id integer NOT NULL,
  carga_id integer,
  customer_phone text NOT NULL,
  customer_name text,
  driver_name text,
  data_entrega text,
  valor_total numeric,
  peso_total numeric,
  quantidade_itens integer,
  endereco_completo text,
  bairro text,
  cidade text,
  estado text,
  referencia text,
  observacao text,
  produtos jsonb,
  status text DEFAULT 'FATU',
  detected_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(pedido_numero)
);

-- Enable RLS
ALTER TABLE public.delivered_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can read delivered_orders"
  ON public.delivered_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert delivered_orders"
  ON public.delivered_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update delivered_orders"
  ON public.delivered_orders
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Add trigger for updated_at
CREATE TRIGGER update_delivered_orders_updated_at
  BEFORE UPDATE ON public.delivered_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries
CREATE INDEX idx_delivered_orders_pedido_numero ON public.delivered_orders(pedido_numero);
CREATE INDEX idx_delivered_orders_customer_phone ON public.delivered_orders(customer_phone);
CREATE INDEX idx_delivered_orders_status ON public.delivered_orders(status);
CREATE INDEX idx_delivered_orders_detected_at ON public.delivered_orders(detected_at DESC);