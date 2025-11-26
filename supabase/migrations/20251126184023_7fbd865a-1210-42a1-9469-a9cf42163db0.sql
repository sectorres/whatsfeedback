-- Adicionar colunas para armazenar detalhes completos do pedido no campaign_sends
ALTER TABLE campaign_sends 
ADD COLUMN IF NOT EXISTS pedido_detalhes JSONB DEFAULT NULL;

-- Adicionar comentário explicativo
COMMENT ON COLUMN campaign_sends.pedido_detalhes IS 'Armazena os detalhes completos do pedido (cliente, produtos, endereço) no momento do envio da campanha';