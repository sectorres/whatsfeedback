// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface EvolutionCredentials {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  isOfficial: boolean;
  templateName?: string;
  templateLanguage?: string;
}

/**
 * Busca as credenciais da Evolution API
 * Primeiro verifica se há configuração no banco (oficial), senão usa os secrets (não oficial)
 */
export async function getEvolutionCredentials(): Promise<EvolutionCredentials> {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials not configured');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Buscar configuração ativa do banco
  const { data: config, error } = await supabase
    .from('evolution_api_config')
    .select('*')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching evolution config:', error);
  }

  // Se a configuração é "official" e tem todas as credenciais, usar do banco
  if (config && config.config_type === 'official' && config.api_url && config.api_key && config.instance_name) {
    console.log('Using official Evolution API config from database');
    return {
      apiUrl: config.api_url,
      apiKey: config.api_key,
      instanceName: config.instance_name,
      isOfficial: true,
      templateName: config.template_name || undefined,
      templateLanguage: config.template_language || 'pt_BR',
    };
  }

  // Caso contrário, usar os secrets (não oficial)
  console.log('Using unofficial Evolution API config from secrets');
  const apiUrl = Deno.env.get('EVOLUTION_API_URL');
  const apiKey = Deno.env.get('EVOLUTION_API_KEY');
  const instanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME');

  if (!apiUrl || !apiKey || !instanceName) {
    throw new Error('Evolution API credentials not configured');
  }

  return {
    apiUrl,
    apiKey,
    instanceName,
    isOfficial: false
  };
}