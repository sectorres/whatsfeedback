-- Adicionar constraint única para evitar duplicação de conversas por telefone
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_phone 
ON conversations(customer_phone) 
WHERE status != 'deleted';