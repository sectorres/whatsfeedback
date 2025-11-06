import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Loader2, Image as ImageIcon } from "lucide-react";

export function LogoManager() {
  const [uploading, setUploading] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentLogo();
  }, []);

  const loadCurrentLogo = async () => {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('config_value')
        .eq('config_key', 'logo_url')
        .maybeSingle();

      if (error) throw error;
      
      if (data?.config_value) {
        setCurrentLogoUrl(data.config_value);
      }
    } catch (error: any) {
      console.error('Erro ao carregar logo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = event.target.files?.[0];
      
      if (!file) return;

      // Validar tipo de arquivo
      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione uma imagem válida');
        return;
      }

      // Validar tamanho (máximo 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('A imagem deve ter no máximo 2MB');
        return;
      }

      // Criar nome único para o arquivo
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;

      // Deletar logo anterior se existir
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('logos')
            .remove([oldPath]);
        }
      }

      // Upload do arquivo
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName);

      // Salvar URL no banco de dados
      const { error: updateError } = await supabase
        .from('app_config')
        .upsert({
          config_key: 'logo_url',
          config_value: publicUrl
        }, {
          onConflict: 'config_key'
        });

      if (updateError) throw updateError;

      setCurrentLogoUrl(publicUrl);
      toast.success('Logo atualizado com sucesso!');
      
      // Recarregar página para atualizar header
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao atualizar logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    try {
      setUploading(true);

      // Deletar arquivo do storage
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('logos')
            .remove([oldPath]);
        }
      }

      // Atualizar banco de dados
      const { error } = await supabase
        .from('app_config')
        .upsert({
          config_key: 'logo_url',
          config_value: ''
        }, {
          onConflict: 'config_key'
        });

      if (error) throw error;

      setCurrentLogoUrl('');
      toast.success('Logo removido com sucesso!');
      
      // Recarregar página para atualizar header
      setTimeout(() => window.location.reload(), 1000);
    } catch (error: any) {
      console.error('Erro ao remover logo:', error);
      toast.error('Erro ao remover logo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Logo da Aplicação
        </CardTitle>
        <CardDescription>
          Personalize o logo exibido no cabeçalho da aplicação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {currentLogoUrl && (
              <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-muted/30">
                <p className="text-sm font-medium">Logo Atual:</p>
                <img 
                  src={currentLogoUrl} 
                  alt="Logo atual" 
                  className="max-h-20 object-contain"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRemoveLogo}
                  disabled={uploading}
                >
                  Remover Logo
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="logo-upload">
                {currentLogoUrl ? 'Alterar Logo' : 'Adicionar Logo'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="cursor-pointer"
                />
                {uploading && <Loader2 className="h-5 w-5 animate-spin" />}
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: PNG, JPG, SVG. Tamanho máximo: 2MB
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
