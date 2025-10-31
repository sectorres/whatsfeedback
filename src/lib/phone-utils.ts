/**
 * Normaliza número de telefone removendo caracteres especiais e padronizando formato
 * 
 * Trata formatos como:
 * - (011) 98765-4321
 * - 011987654321
 * - +55 11 98765-4321
 * - 5511987654321
 * 
 * @param phone - Número de telefone em qualquer formato
 * @returns Número limpo contendo apenas dígitos (sem código do país)
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  
  // Remove todos os caracteres não numéricos (parênteses, hífens, espaços, +)
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Remove o código do país (55) se presente, mantendo apenas DDD + número
  if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
    cleanPhone = cleanPhone.substring(2);
  }
  
  return cleanPhone;
}

/**
 * Formata número de telefone para envio via WhatsApp (adiciona código do país)
 * 
 * @param phone - Número de telefone
 * @returns Número formatado com código do país 55 (Brasil)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const cleanPhone = normalizePhone(phone);
  
  // Adicionar código do país 55 se não estiver presente
  if (cleanPhone.length >= 10) {
    return '55' + cleanPhone;
  }
  
  return cleanPhone;
}
