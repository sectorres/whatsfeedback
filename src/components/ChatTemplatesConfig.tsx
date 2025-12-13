import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Loader2, MessageSquare, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  template_name: string;
  nickname: string | null;
  category: string;
  language: string;
  meta_status: string;
  is_disabled: boolean;
}

export function ChatTemplatesConfig() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [enabledTemplates, setEnabledTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
    loadEnabledTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, template_name, nickname, category, language, meta_status, is_disabled')
        .eq('meta_status', 'approved')
        .eq('is_disabled', false)
        .order('template_name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const loadEnabledTemplates = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('config_value')
      .eq('config_key', 'chat_enabled_templates')
      .maybeSingle();
    
    if (data?.config_value) {
      try {
        setEnabledTemplates(JSON.parse(data.config_value));
      } catch {
        setEnabledTemplates([]);
      }
    }
  };

  const handleToggleTemplate = (templateId: string) => {
    setEnabledTemplates(prev => {
      if (prev.includes(templateId)) {
        return prev.filter(id => id !== templateId);
      }
      return [...prev, templateId];
    });
  };

  const handleSelectAll = () => {
    if (enabledTemplates.length === templates.length) {
      setEnabledTemplates([]);
    } else {
      setEnabledTemplates(templates.map(t => t.id));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase
        .from('app_config')
        .select('id')
        .eq('config_key', 'chat_enabled_templates')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_config')
          .update({ config_value: JSON.stringify(enabledTemplates) })
          .eq('config_key', 'chat_enabled_templates');
      } else {
        await supabase
          .from('app_config')
          .insert({ 
            config_key: 'chat_enabled_templates', 
            config_value: JSON.stringify(enabledTemplates) 
          });
      }

      toast.success('Configuração salva com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Templates no Chat
        </CardTitle>
        <CardDescription>
          Selecione quais templates aparecerão para seleção no chat de atendimento.
          Se nenhum estiver selecionado, todos os templates aprovados serão exibidos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum template aprovado disponível
          </p>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {enabledTemplates.length === templates.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
              </Button>
              <Badge variant="secondary">
                {enabledTemplates.length} de {templates.length} selecionados
              </Badge>
            </div>
            
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {templates.map(template => (
                <div 
                  key={template.id} 
                  className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <Checkbox
                    id={template.id}
                    checked={enabledTemplates.includes(template.id)}
                    onCheckedChange={() => handleToggleTemplate(template.id)}
                  />
                  <Label 
                    htmlFor={template.id} 
                    className="flex-1 cursor-pointer flex items-center gap-2"
                  >
                    <span className="font-medium">{template.nickname || template.template_name}</span>
                    {template.nickname && (
                      <span className="text-xs text-muted-foreground">({template.template_name})</span>
                    )}
                    <Badge variant="outline" className="text-xs">
                      {template.language}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {template.category}
                    </Badge>
                  </Label>
                </div>
              ))}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Configuração
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
