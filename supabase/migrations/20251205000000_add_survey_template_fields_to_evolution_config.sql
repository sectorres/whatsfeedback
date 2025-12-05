-- Adiciona colunas para o template de pesquisa de satisfação
ALTER TABLE "public"."evolution_api_config" ADD COLUMN "survey_template_name" character varying NULL;
ALTER TABLE "public"."evolution_api_config" ADD COLUMN "survey_template_language" character varying NULL;

-- Atualiza a coluna 'updated_at'
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cria trigger para atualizar updated_at
DROP TRIGGER IF EXISTS "set_updated_at" ON "public"."evolution_api_config";
CREATE TRIGGER "set_updated_at"
BEFORE UPDATE ON "public"."evolution_api_config"
FOR EACH ROW
EXECUTE FUNCTION "public"."set_current_timestamp_updated_at"();