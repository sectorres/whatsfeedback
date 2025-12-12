import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Edit2, Save, X, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TriggerPhrase {
  id: string;
  phrase: string;
  response: string;
  is_active: boolean;
  match_type: 'contains' | 'exact' | 'starts_with';
}

export function AiTriggerPhrasesConfig() {
  const [phrases, setPhrases] = useState<TriggerPhrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New phrase form
  const [newPhrase, setNewPhrase] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [newMatchType, setNewMatchType] = useState<'contains' | 'exact' | 'starts_with'>('contains');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Edit form
  const [editPhrase, setEditPhrase] = useState("");
  const [editResponse, setEditResponse] = useState("");
  const [editMatchType, setEditMatchType] = useState<'contains' | 'exact' | 'starts_with'>('contains');

  useEffect(() => {
    loadPhrases();
  }, []);

  const loadPhrases = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_trigger_phrases')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPhrases((data || []).map(p => ({
        ...p,
        match_type: p.match_type as 'contains' | 'exact' | 'starts_with'
      })));
    } catch (error) {
      console.error('Error loading trigger phrases:', error);
      toast.error('Erro ao carregar frases gatilho');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newPhrase.trim() || !newResponse.trim()) {
      toast.error('Preencha a frase e a resposta');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_trigger_phrases')
        .insert({
          phrase: newPhrase.trim(),
          response: newResponse.trim(),
          match_type: newMatchType,
          is_active: true
        });

      if (error) throw error;
      
      toast.success('Frase gatilho adicionada');
      setNewPhrase("");
      setNewResponse("");
      setNewMatchType('contains');
      setShowAddForm(false);
      loadPhrases();
    } catch (error) {
      console.error('Error adding trigger phrase:', error);
      toast.error('Erro ao adicionar frase gatilho');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (phrase: TriggerPhrase) => {
    setEditingId(phrase.id);
    setEditPhrase(phrase.phrase);
    setEditResponse(phrase.response);
    setEditMatchType(phrase.match_type);
  };

  const handleSaveEdit = async () => {
    if (!editPhrase.trim() || !editResponse.trim()) {
      toast.error('Preencha a frase e a resposta');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_trigger_phrases')
        .update({
          phrase: editPhrase.trim(),
          response: editResponse.trim(),
          match_type: editMatchType
        })
        .eq('id', editingId);

      if (error) throw error;
      
      toast.success('Frase gatilho atualizada');
      setEditingId(null);
      loadPhrases();
    } catch (error) {
      console.error('Error updating trigger phrase:', error);
      toast.error('Erro ao atualizar frase gatilho');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('ai_trigger_phrases')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      
      setPhrases(prev => prev.map(p => p.id === id ? { ...p, is_active: isActive } : p));
      toast.success(isActive ? 'Frase ativada' : 'Frase desativada');
    } catch (error) {
      console.error('Error toggling trigger phrase:', error);
      toast.error('Erro ao atualizar frase');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta frase gatilho?')) return;

    try {
      const { error } = await supabase
        .from('ai_trigger_phrases')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Frase gatilho excluída');
      loadPhrases();
    } catch (error) {
      console.error('Error deleting trigger phrase:', error);
      toast.error('Erro ao excluir frase gatilho');
    }
  };

  const matchTypeLabels = {
    contains: 'Contém',
    exact: 'Exato',
    starts_with: 'Começa com'
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
          <MessageSquare className="h-5 w-5" />
          Frases Gatilho da IA
        </CardTitle>
        <CardDescription>
          Configure frases que ativam a IA e suas respostas automáticas. A IA só será acionada quando uma mensagem corresponder a alguma frase cadastrada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new phrase button/form */}
        {!showAddForm ? (
          <Button onClick={() => setShowAddForm(true)} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Frase Gatilho
          </Button>
        ) : (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
            <div className="space-y-2">
              <Label>Frase Gatilho</Label>
              <Input
                value={newPhrase}
                onChange={(e) => setNewPhrase(e.target.value)}
                placeholder="Ex: pedido, meu pedido, rastrear"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Correspondência</Label>
              <Select value={newMatchType} onValueChange={(v: any) => setNewMatchType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contém (a mensagem contém a frase)</SelectItem>
                  <SelectItem value="exact">Exato (mensagem igual à frase)</SelectItem>
                  <SelectItem value="starts_with">Começa com (mensagem inicia com a frase)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Resposta da IA</Label>
              <Textarea
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                placeholder="Resposta que a IA deve enviar quando detectar esta frase..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Use {"{nome}"} para inserir o nome do cliente, {"{telefone}"} para o telefone, e {"{pedido}"} para dados do pedido encontrado na API.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAdd} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Phrases list */}
        {phrases.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma frase gatilho cadastrada. A IA não será acionada automaticamente.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Frase</TableHead>
                <TableHead className="w-[120px]">Tipo</TableHead>
                <TableHead>Resposta</TableHead>
                <TableHead className="w-[80px]">Ativo</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {phrases.map((phrase) => (
                <TableRow key={phrase.id}>
                  {editingId === phrase.id ? (
                    <>
                      <TableCell>
                        <Input
                          value={editPhrase}
                          onChange={(e) => setEditPhrase(e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select value={editMatchType} onValueChange={(v: any) => setEditMatchType(v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="contains">Contém</SelectItem>
                            <SelectItem value="exact">Exato</SelectItem>
                            <SelectItem value="starts_with">Começa com</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Textarea
                          value={editResponse}
                          onChange={(e) => setEditResponse(e.target.value)}
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>
                        <Switch checked={phrase.is_active} disabled />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={saving}>
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="font-medium">{phrase.phrase}</TableCell>
                      <TableCell>{matchTypeLabels[phrase.match_type]}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{phrase.response}</TableCell>
                      <TableCell>
                        <Switch
                          checked={phrase.is_active}
                          onCheckedChange={(checked) => handleToggleActive(phrase.id, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(phrase)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(phrase.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
