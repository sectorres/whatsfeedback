-- Adicionar colunas para armazenar o período de análise dos insights
ALTER TABLE satisfaction_insights 
ADD COLUMN IF NOT EXISTS date_from timestamp with time zone,
ADD COLUMN IF NOT EXISTS date_to timestamp with time zone;