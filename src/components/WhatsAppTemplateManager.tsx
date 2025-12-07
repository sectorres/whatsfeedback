import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { 
  Plus, 
  Send, 
  RefreshCw, 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  FileText,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppTemplate {
  id: string;
  template_name: string;
  template_type: string;
  category: string;
  language: string;
  header_text: string | null;
  body_text: string;
  footer_text: string | null;
  variables: Variable[];
  meta_template_id: string | null;
  meta_status: string;
  meta_rejection_reason: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
}

interface Variable {
  index: number;
  type: string;
  example: string;
  description: string;
}

const STATUS_CONFIG = {
  pending: { label: "Pendente", icon: Clock, color: "bg-yellow-500" },
  in_review: { label: "Em Análise", icon: AlertCircle, color: "bg-blue-500" },
  approved: { label: "Aprovado", icon: CheckCircle, color: "bg-green-500" },
  rejected: { label: "Rejeitado", icon: XCircle, color: "bg-red-500" },
};

export const WhatsAppTemplateManager = () => {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [templateName, setTemplateName] = useState("");
  const [category, setCategory] = useState<string>("delivery_notification");
  const [language, setLanguage] = useState("pt_BR");
  const [headerText, setHeaderText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [variables, setVariables] = useState<Variable[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setTemplates((data || []).map(t => ({
        ...t,
        variables: (t.variables as Variable[]) || []
      })));
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  };

  const handleAddVariable = () => {
    setVariables([
      ...variables,
      { 
        index: variables.length + 1, 
        type: "text", 
        example: "", 
        description: "" 
      }
    ]);
  };

  const handleRemoveVariable = (index: number) => {
    const newVars = variables.filter((_, i) => i !== index);
    setVariables(newVars.map((v, i) => ({ ...v, index: i + 1 })));
  };

  const handleVariableChange = (index: number, field: keyof Variable, value: string) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariables(newVars);
  };

  const handleSaveTemplate = async () => {
    if (!templateName || !bodyText) {
      toast.error("Nome e corpo do template são obrigatórios");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .insert({
          template_name: templateName.toLowerCase().replace(/\s+/g, '_'),
          template_type: 'UTILITY',
          category,
          language,
          header_text: headerText || null,
          body_text: bodyText,
          footer_text: footerText || null,
          variables: variables,
          meta_status: 'pending'
        });

      if (error) throw error;

      toast.success("Template salvo com sucesso!");
      setDialogOpen(false);
      resetForm();
      loadTemplates();
    } catch (error: any) {
      console.error('Erro ao salvar template:', error);
      if (error.code === '23505') {
        toast.error("Já existe um template com este nome e idioma");
      } else {
        toast.error("Erro ao salvar template");
      }
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setTemplateName("");
    setCategory("delivery_notification");
    setLanguage("pt_BR");
    setHeaderText("");
    setBodyText("");
    setFooterText("");
    setVariables([]);
  };

  const handleSubmitToMeta = async (templateId: string) => {
    setSubmitting(templateId);
    try {
      const { data, error } = await supabase.functions.invoke('submit-template-meta', {
        body: { templateId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Template enviado para a Meta com sucesso!");
        loadTemplates();
      } else {
        toast.error(data.error || "Erro ao enviar template");
      }
    } catch (error) {
      console.error('Erro ao enviar template:', error);
      toast.error("Erro ao enviar template para a Meta");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSyncStatus = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-template-status');

      if (error) throw error;

      if (data.success) {
        toast.success(`${data.updated} template(s) atualizado(s)`);
        loadTemplates();
      } else {
        toast.error(data.error || "Erro ao sincronizar status");
      }
    } catch (error) {
      console.error('Erro ao sincronizar status:', error);
      toast.error("Erro ao sincronizar status dos templates");
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;
    
    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Template excluído");
      loadTemplates();
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast.error("Erro ao excluir template");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Gerenciador de Templates WhatsApp
            </CardTitle>
            <CardDescription>
              Crie e gerencie templates para envio via API oficial da Meta
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSyncStatus} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Sincronizar Status</span>
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Template</Label>
                      <Input
                        placeholder="meu_template"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        Apenas letras minúsculas, números e underscores
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Categoria</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="delivery_notification">Notificação de Entrega</SelectItem>
                          <SelectItem value="satisfaction_survey">Pesquisa de Satisfação</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Idioma</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt_BR">Português (BR)</SelectItem>
                        <SelectItem value="en_US">English (US)</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Cabeçalho (opcional)</Label>
                    <Input
                      placeholder="Texto do cabeçalho"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Corpo da Mensagem *</Label>
                    <Textarea
                      placeholder="Olá {{1}}, sua entrega está confirmada para {{2}}."
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {"{{1}}"}, {"{{2}}"}, etc. para variáveis
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Rodapé (opcional)</Label>
                    <Input
                      placeholder="Texto do rodapé"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Variáveis</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddVariable}>
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    </div>
                    
                    {variables.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma variável definida. Clique em "Adicionar" para criar.
                      </p>
                    )}

                    {variables.map((variable, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 border rounded-lg">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs">Variável</Label>
                            <Input value={`{{${variable.index}}}`} disabled className="text-center" />
                          </div>
                          <div>
                            <Label className="text-xs">Exemplo</Label>
                            <Input
                              placeholder="João Silva"
                              value={variable.example}
                              onChange={(e) => handleVariableChange(index, 'example', e.target.value)}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Descrição</Label>
                            <Input
                              placeholder="Nome do cliente"
                              value={variable.description}
                              onChange={(e) => handleVariableChange(index, 'description', e.target.value)}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-5"
                          onClick={() => handleRemoveVariable(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">Tipo de Template</p>
                    <p className="text-xs text-muted-foreground">
                      Todos os templates são criados como <strong>UTILITY</strong> (Utilidade), 
                      nunca como Marketing, conforme as diretrizes da Meta.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveTemplate} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salvar Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum template criado ainda</p>
            <p className="text-sm">Clique em "Novo Template" para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Enviado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => {
                  const statusConfig = STATUS_CONFIG[template.meta_status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
                  const StatusIcon = statusConfig.icon;
                  
                  return (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.template_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {template.category === 'delivery_notification' ? 'Entrega' : 'Satisfação'}
                        </Badge>
                      </TableCell>
                      <TableCell>{template.language}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${statusConfig.color === 'bg-green-500' ? 'text-green-500' : statusConfig.color === 'bg-red-500' ? 'text-red-500' : statusConfig.color === 'bg-yellow-500' ? 'text-yellow-500' : 'text-blue-500'}`} />
                          <span className="text-sm">{statusConfig.label}</span>
                        </div>
                        {template.meta_rejection_reason && (
                          <p className="text-xs text-red-500 mt-1">{template.meta_rejection_reason}</p>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(template.submitted_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {template.meta_status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleSubmitToMeta(template.id)}
                              disabled={submitting === template.id}
                            >
                              {submitting === template.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              <span className="ml-1">Enviar</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
