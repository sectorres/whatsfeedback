-- Add pedido_id column to campaign_sends to store the API order ID
ALTER TABLE campaign_sends 
ADD COLUMN IF NOT EXISTS pedido_id INTEGER;