-- Adicionar colunas para template de pesquisa de satisfação
ALTER TABLE public.evolution_api_config 
ADD COLUMN IF NOT EXISTS survey_template_name TEXT DEFAULT 'entrega_realizada',
ADD COLUMN IF NOT EXISTS survey_template_language TEXT DEFAULT 'pt_BR';