-- Adicionar coluna driver_name à tabela campaign_sends
ALTER TABLE public.campaign_sends 
ADD COLUMN driver_name text;