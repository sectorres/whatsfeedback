import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Template {
  id: string;
  template_name: string;
  nickname: string | null;
  body_text: string;
  header_text: string | null;
  footer_text: string | null;
  variables: Array<{ index: number; type: string; example: string; description: string }>;
  language: string;
  meta_status: string;
  is_disabled: boolean;
}

interface ChatTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerPhone: string;
  customerName: string | null;
  conversationId: string;
  onTemplateSent: () => void;
}

export function ChatTemplateSelector({
  open,
  onOpenChange,
  customerPhone,
  customerName,
  conversationId,
  onTemplateSent
}: ChatTemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [variableValues, setVariableValues] = useState<Record<number, string>>({});
  const [chatEnabledTemplates, setChatEnabledTemplates] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadTemplates();
      loadChatEnabledTemplates();
    }
  }, [open]);

  const loadChatEnabledTemplates = async () => {
    const { data } = await supabase
      .from('app_config')
      .select('config_value')
      .eq('config_key', 'chat_enabled_templates')
      .maybeSingle();
    
    if (data?.config_value) {
      try {
        setChatEnabledTemplates(JSON.parse(data.config_value));
      } catch {
        setChatEnabledTemplates([]);
      }
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('meta_status', 'approved')
        .eq('is_disabled', false)
        .order('template_name');

      if (error) throw error;
      
      setTemplates((data || []).map(t => ({
        ...t,
        variables: (t.variables as unknown as Template['variables']) || []
      })));
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // Filtra templates habilitados para o chat
  const visibleTemplates = chatEnabledTemplates.length > 0
    ? templates.filter(t => chatEnabledTemplates.includes(t.id))
    : templates;

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    setVariableValues({});
    
    // Preencher automaticamente variável 1 com nome do cliente se existir
    const template = templates.find(t => t.id === templateId);
    if (template?.variables?.length > 0 && customerName) {
      setVariableValues({ 1: customerName });
    }
  };

  const handleVariableChange = (index: number, value: string) => {
    setVariableValues(prev => ({ ...prev, [index]: value }));
  };

  const getPreviewText = () => {
    if (!selectedTemplate) return "";
    
    let text = selectedTemplate.body_text;
    
    // Substituir variáveis
    selectedTemplate.variables?.forEach((v) => {
      const value = variableValues[v.index] || `{{${v.index}}}`;
      text = text.replace(new RegExp(`\\{\\{${v.index}\\}\\}`, 'g'), value);
    });
    
    return text;
  };

  const allVariablesFilled = () => {
    if (!selectedTemplate?.variables?.length) return true;
    return selectedTemplate.variables.every(v => variableValues[v.index]?.trim());
  };

  const handleSendTemplate = async () => {
    if (!selectedTemplate || !allVariablesFilled()) {
      toast.error('Preencha todas as variáveis do template');
      return;
    }

    setSending(true);
    try {
      // Preparar parâmetros do template
      const parameters = selectedTemplate.variables
        ?.sort((a, b) => a.index - b.index)
        .map(v => variableValues[v.index]) || [];

      const { data, error } = await supabase.functions.invoke('whatsapp-send-chat-template', {
        body: {
          phone: customerPhone,
          templateName: selectedTemplate.template_name,
          templateLanguage: selectedTemplate.language,
          parameters,
          conversationId
        }
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao enviar template');
      }

      toast.success('Template enviado com sucesso!');
      onOpenChange(false);
      onTemplateSent();
      
      // Reset form
      setSelectedTemplateId("");
      setVariableValues({});
    } catch (error: any) {
      console.error('Erro ao enviar template:', error);
      toast.error(error.message || 'Erro ao enviar template');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Enviar Template
          </DialogTitle>
          <DialogDescription>
            Selecione um template aprovado pela Meta para iniciar a conversa
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um template" />
                </SelectTrigger>
                <SelectContent>
                  {visibleTemplates.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      Nenhum template disponível
                    </div>
                  ) : (
                    visibleTemplates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center gap-2">
                          <span>{template.nickname || template.template_name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {template.language}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedTemplate && (
              <>
                {/* Variáveis */}
                {selectedTemplate.variables?.length > 0 && (
                  <div className="space-y-3">
                    <Label>Variáveis</Label>
                    {selectedTemplate.variables.sort((a, b) => a.index - b.index).map((variable) => (
                      <div key={variable.index} className="grid gap-2">
                        <Label className="text-sm text-muted-foreground">
                          {`{{${variable.index}}}`} - {variable.description || `Variável ${variable.index}`}
                        </Label>
                        <Input
                          placeholder={variable.example || `Valor para {{${variable.index}}}`}
                          value={variableValues[variable.index] || ''}
                          onChange={(e) => handleVariableChange(variable.index, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* Preview */}
                <div className="space-y-2">
                  <Label>Prévia da Mensagem</Label>
                  <ScrollArea className="h-32 rounded-md border bg-muted/50 p-3">
                    <p className="text-sm whitespace-pre-wrap">{getPreviewText()}</p>
                  </ScrollArea>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSendTemplate} 
            disabled={!selectedTemplateId || !allVariablesFilled() || sending}
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Enviar Template
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
