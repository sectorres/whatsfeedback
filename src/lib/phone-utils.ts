/**
 * Normaliza número de telefone removendo caracteres especiais e padronizando formato
 *
 * Trata formatos como:
 * - (011) 98765-4321
 * - 0 11 98765-4321
 * - 011987654321
 * - +55 11 98765-4321
 * - 0055 11 98765-4321
 * - 5511987654321
 *
 * @param phone - Número de telefone em qualquer formato
 * @returns Número limpo contendo apenas DDD + número (sem código do país e sem zeros à esquerda)
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';

  // Remove todos os caracteres não numéricos (parênteses, hífens, espaços, +)
  let cleanPhone = phone.replace(/\D/g, '');

  // Remove prefixo internacional 00, se presente
  if (cleanPhone.startsWith('00')) {
    cleanPhone = cleanPhone.substring(2);
  }

  // Remove o código do país (55) se presente, mantendo apenas DDD + número
  if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
    cleanPhone = cleanPhone.substring(2);
  }

  // Remove zeros à esquerda (ex.: 011 -> 11)
  cleanPhone = cleanPhone.replace(/^0+/, '');

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
  if (!cleanPhone.startsWith('55') && cleanPhone.length >= 10) {
    return '55' + cleanPhone;
  }

  return cleanPhone;
}

/**
 * Valida se um número de telefone é válido para envio via WhatsApp
 * 
 * @param phone - Número de telefone
 * @returns true se o número é válido
 */
export function isValidPhoneNumber(phone: string): boolean {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  
  // Formato esperado: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos) = 12 ou 13 dígitos
  return cleanPhone.length >= 12 && cleanPhone.length <= 13;
}
