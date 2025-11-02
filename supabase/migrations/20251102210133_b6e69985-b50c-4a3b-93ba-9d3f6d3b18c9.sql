-- Add quantidade_itens column to campaign_sends
ALTER TABLE campaign_sends 
ADD COLUMN IF NOT EXISTS quantidade_itens integer DEFAULT 0;