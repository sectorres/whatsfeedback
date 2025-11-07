-- Criar políticas RLS para o bucket whatsapp-media permitir uploads de anexos

-- Permitir que usuários autenticados façam upload de arquivos na pasta attachments
CREATE POLICY "Usuários autenticados podem fazer upload de anexos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-media' AND
  (storage.foldername(name))[1] = 'attachments'
);

-- Permitir que usuários autenticados leiam arquivos na pasta attachments
CREATE POLICY "Usuários autenticados podem visualizar anexos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'whatsapp-media' AND
  (storage.foldername(name))[1] = 'attachments'
);

-- Permitir que usuários autenticados atualizem seus próprios anexos
CREATE POLICY "Usuários autenticados podem atualizar anexos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'whatsapp-media' AND
  (storage.foldername(name))[1] = 'attachments'
);

-- Permitir que usuários autenticados deletem anexos
CREATE POLICY "Usuários autenticados podem deletar anexos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'whatsapp-media' AND
  (storage.foldername(name))[1] = 'attachments'
);