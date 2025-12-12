import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Loader2, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

interface Variable {
  index: number;
  type: string;
  example: string;
  description: string;
  mapping?: string;
}

interface Template {
  id: string;
  template_name: string;
  body_text: string;
  variables: Variable[];
  category: string;
}

// Campos de dados disponíveis para mapeamento
const DATA_FIELDS = [
  { value: "customer_name", label: "Nome do Cliente" },
  { value: "pedido_numero", label: "Número do Pedido" },
  { value: "data_entrega", label: "Data de Entrega (formatada)" },
  { value: "driver_name", label: "Nome do Motorista" },
  { value: "nota_fiscal", label: "Nota Fiscal" },
  { value: "valor_total", label: "Valor Total" },
  { value: "endereco_completo", label: "Endereço Completo" },
  { value: "bairro", label: "Bairro" },
  { value: "cidade", label: "Cidade" },
  { value: "estado", label: "Estado" },
  { value: "cep", label: "CEP" },
  { value: "rota", label: "Rota" },
  { value: "quantidade_itens", label: "Quantidade de Itens" },
  { value: "peso_total", label: "Peso Total" },
];

interface TemplateVariableMappingProps {
  templateId: string;
  templateName: string;
  bodyText: string;
  variables: Variable[];
  category: string;
  onSave?: () => void;
}

export const TemplateVariableMapping = ({ 
  templateId, 
  templateName, 
  bodyText, 
  variables, 
  category,
  onSave 
}: TemplateVariableMappingProps) => {
  const [mappings, setMappings] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    // Carregar mapeamentos existentes das variáveis
    const existingMappings: Record<number, string> = {};
    variables.forEach((v) => {
      if (v.mapping) {
        existingMappings[v.index] = v.mapping;
      }
    });
    setMappings(existingMappings);
  }, [variables]);

  const handleMappingChange = (variableIndex: number, fieldValue: string) => {
    setMappings(prev => ({
      ...prev,
      [variableIndex]: fieldValue
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Atualizar as variáveis com os mapeamentos
      const updatedVariables = variables.map(v => ({
        ...v,
        mapping: mappings[v.index] || null
      }));

      const { error } = await supabase
        .from('whatsapp_templates')
        .update({ variables: updatedVariables })
        .eq('id', templateId);

      if (error) throw error;

      toast.success("Mapeamento de variáveis salvo!");
      setDialogOpen(false);
      onSave?.();
    } catch (error) {
      console.error('Erro ao salvar mapeamento:', error);
      toast.error("Erro ao salvar mapeamento");
    } finally {
      setSaving(false);
    }
  };

  // Extrair variáveis do texto do corpo para mostrar contexto
  const getVariableContext = (index: number): string => {
    const regex = new RegExp(`\\{\\{${index}\\}\\}`, 'g');
    const matches = bodyText.match(regex);
    if (!matches) return "";
    
    // Pegar um trecho ao redor da variável
    const varPosition = bodyText.indexOf(`{{${index}}}`);
    const start = Math.max(0, varPosition - 30);
    const end = Math.min(bodyText.length, varPosition + 30);
    let context = bodyText.substring(start, end);
    if (start > 0) context = "..." + context;
    if (end < bodyText.length) context = context + "...";
    return context;
  };

  if (!variables || variables.length === 0) {
    return null;
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" title="Configurar variáveis">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mapeamento de Variáveis - {templateName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <p className="font-medium mb-2">Texto do Template:</p>
            <p className="whitespace-pre-wrap text-xs">{bodyText}</p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Variável</TableHead>
                <TableHead>Contexto</TableHead>
                <TableHead className="w-48">Campo de Dados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variables.map((variable) => (
                <TableRow key={variable.index}>
                  <TableCell className="font-mono text-sm">
                    {`{{${variable.index}}}`}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {getVariableContext(variable.index)}
                    {variable.example && (
                      <span className="block mt-1 text-primary">
                        Ex: {variable.example}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={mappings[variable.index] || ""}
                      onValueChange={(value) => handleMappingChange(variable.index, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Mapeamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
