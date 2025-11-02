-- Adicionar campos para métricas de desempenho dos motoristas na tabela campaign_sends
ALTER TABLE campaign_sends 
ADD COLUMN IF NOT EXISTS peso_total numeric,
ADD COLUMN IF NOT EXISTS valor_total numeric,
ADD COLUMN IF NOT EXISTS quantidade_entregas integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantidade_skus integer;