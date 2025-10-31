-- Permitir que campaign_id seja null na tabela satisfaction_insights
-- já que insights agora são gerados por período e não por campanha
ALTER TABLE satisfaction_insights 
ALTER COLUMN campaign_id DROP NOT NULL;