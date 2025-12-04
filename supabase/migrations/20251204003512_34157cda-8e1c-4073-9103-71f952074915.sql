-- Adicionar campos de template na configuração da Evolution API
ALTER TABLE public.evolution_api_config 
ADD COLUMN IF NOT EXISTS template_name TEXT,
ADD COLUMN IF NOT EXISTS template_language TEXT DEFAULT 'pt_BR';