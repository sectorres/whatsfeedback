-- Adiciona as colunas survey_template_name e survey_template_language à tabela evolution_api_config
ALTER TABLE public.evolution_api_config
ADD COLUMN survey_template_name character varying(255) NULL,
ADD COLUMN survey_template_language character varying(10) NULL;

-- Atualiza a função getEvolutionCredentials para incluir os novos campos
-- Nota: Esta função é definida em Deno/TS, mas a migração SQL deve garantir que a tabela esteja pronta.
-- A função getEvolutionCredentials em supabase/functions/_shared/evolution-config.ts será atualizada separadamente.