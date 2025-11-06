-- Adicionar constraint única para campaign_send_id
ALTER TABLE public.satisfaction_surveys 
ADD CONSTRAINT satisfaction_surveys_campaign_send_id_key 
UNIQUE (campaign_send_id);