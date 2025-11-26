-- Remover a coluna pedido_detalhes que não é mais necessária
ALTER TABLE campaign_sends 
DROP COLUMN IF EXISTS pedido_detalhes;