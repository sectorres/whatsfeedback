-- Adicionar coluna pedido_numero à tabela campaign_sends
ALTER TABLE public.campaign_sends 
ADD COLUMN pedido_numero text;