-- Remover políticas se existirem
DROP POLICY IF EXISTS "Usuários autenticados podem ler configurações" ON public.ai_config;
DROP POLICY IF EXISTS "Usuários autenticados podem editar configurações" ON public.ai_config;

-- Remover trigger se existir
DROP TRIGGER IF EXISTS update_ai_config_updated_at ON public.ai_config;

-- Criar função para atualizar updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela para configuração de prompts da IA
CREATE TABLE IF NOT EXISTS public.ai_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  prompt TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ai_config ENABLE ROW LEVEL SECURITY;

-- Política: Permitir leitura para usuários autenticados
CREATE POLICY "Usuários autenticados podem ler configurações"
ON public.ai_config
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Política: Permitir escrita para usuários autenticados
CREATE POLICY "Usuários autenticados podem editar configurações"
ON public.ai_config
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_ai_config_updated_at
BEFORE UPDATE ON public.ai_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();