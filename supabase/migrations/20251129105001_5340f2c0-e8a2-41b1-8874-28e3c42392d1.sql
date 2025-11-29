-- Adicionar campos para armazenar dados completos do pedido em campaign_sends
ALTER TABLE campaign_sends 
  ADD COLUMN nota_fiscal TEXT,
  ADD COLUMN data_pedido TEXT,
  ADD COLUMN rota TEXT,
  ADD COLUMN endereco_completo TEXT,
  ADD COLUMN bairro TEXT,
  ADD COLUMN cep TEXT,
  ADD COLUMN cidade TEXT,
  ADD COLUMN estado TEXT,
  ADD COLUMN referencia TEXT,
  ADD COLUMN produtos JSONB;