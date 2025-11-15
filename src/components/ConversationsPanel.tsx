import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Send, X, Loader2, Archive, Paperclip, Image as ImageIcon, File, MoreVertical, Edit, Plus, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ImageModal } from "@/components/ImageModal";
import { isValidPhoneNumber, normalizePhone } from "@/lib/phone-utils";
import { CustomerOrdersDialog } from "@/components/CustomerOrdersDialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Conversation {
  id: string;
  customer_phone: string;
  customer_name: string | null;
  last_message_at: string;
  status: string;
  assigned_to: string | null;
  unread_count: number;
  last_read_at: string | null;
  tags: string[] | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_type: string;
  sender_name: string | null;
  message_text: string;
  message_status: string | null;
  created_at: string;
  media_type?: string | null;
  media_url?: string | null;
  media_transcription?: string | null;
  media_description?: string | null;
}

export function ConversationsPanel({ isOnAtendimentoTab }: { isOnAtendimentoTab: boolean }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "archived">("active");
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [ordersDialogOpen, setOrdersDialogOpen] = useState(false);
  const [editPhoneDialogOpen, setEditPhoneDialogOpen] = useState(false);
  const [editingPhone, setEditingPhone] = useState("");
  const [newConversationDialogOpen, setNewConversationDialogOpen] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState("");
  const [newConversationName, setNewConversationName] = useState("");
  const [creatingConversation, setCreatingConversation] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;
    // Preparar o áudio para evitar bloqueio do navegador
    audioRef.current.load();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatMessageTimestamp = (dateStr: string) => {
    const d = new Date(dateStr);
    return isToday(d) ? format(d, 'HH:mm') : format(d, 'dd/MM HH:mm');
  };

  useEffect(() => {
    loadConversations();

    // Realtime para conversas
    const conversationsChannel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    // Realtime para todas as mensagens (notificação sonora)
    const allMessagesChannel = supabase
      .channel('all-messages-notification')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('Nova mensagem recebida:', {
            sender_type: payload.new.sender_type,
            isOnAtendimentoTab,
            shouldPlaySound: payload.new.sender_type === 'customer' && !isOnAtendimentoTab
          });
          
          // Tocar notificação sonora se for mensagem de cliente E não estiver na aba de atendimento
          if (payload.new.sender_type === 'customer' && !isOnAtendimentoTab) {
            console.log('Tentando tocar notificação...');
            if (audioRef.current) {
              audioRef.current.play()
                .then(() => console.log('Notificação tocada com sucesso'))
                .catch(err => {
                  console.error('Erro ao tocar notificação:', err);
                  // Tentar novamente com interação do usuário
                  toast.error('Nova mensagem recebida! (Som bloqueado pelo navegador)');
                });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(allMessagesChannel);
    };
  }, [isOnAtendimentoTab]); // Adicionar dependência para recriar o listener quando a aba mudar

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);

      // Marcar como lida ao abrir
      markAsRead(selectedConversation.id);

      // Realtime para mensagens da conversa selecionada
      const messagesChannel = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${selectedConversation.id}`
          },
          (payload) => {
            setMessages(prev => [...prev, payload.new as Message]);
            // Incrementar contador de não lidas se for mensagem do cliente
            if (payload.new.sender_type === 'customer') {
              supabase
                .from('conversations')
                .update({ 
                  unread_count: selectedConversation.unread_count + 1 
                })
                .eq('id', selectedConversation.id);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    setLoading(true);
    const { data: activeData, error: activeError } = await supabase
      .from('conversations')
      .select('*')
      .eq('status', 'active')
      .order('last_message_at', { ascending: false });

    const { data: archivedData, error: archivedError } = await supabase
      .from('conversations')
      .select('*')
      .eq('status', 'closed')
      .order('last_message_at', { ascending: false });

    if (activeError) {
      console.error('Error loading active conversations:', activeError);
      toast.error('Erro ao carregar conversas ativas');
    } else {
      setConversations(activeData || []);
    }

    if (archivedError) {
      console.error('Error loading archived conversations:', archivedError);
    } else {
      setArchivedConversations(archivedData || []);
    }
    setLoading(false);
  };

  const loadMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
    } else {
      setMessages(data || []);
    }
  };

  const markAsRead = async (conversationId: string) => {
    await supabase
      .from('conversations')
      .update({ 
        unread_count: 0,
        last_read_at: new Date().toISOString()
      })
      .eq('id', conversationId);
    
    // Atualizar lista local
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversationId 
          ? { ...conv, unread_count: 0, last_read_at: new Date().toISOString() }
          : conv
      )
    );
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    setSending(true);
    try {
      // Enviar via Evolution API
      const response = await supabase.functions.invoke('whatsapp-send', {
        body: {
          phone: selectedConversation.customer_phone,
          message: messageText
        }
      });

      if (response.error) throw response.error;

      // Salvar mensagem no banco
      const { error: dbError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_type: 'operator',
          sender_name: 'Operador',
          message_text: messageText,
          message_status: 'sent'
        });

      if (dbError) throw dbError;

      // Atualizar última mensagem da conversa
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      setMessageText("");
      toast.success('Mensagem enviada!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const closeConversation = async () => {
    if (!selectedConversation) return;

    const { error } = await supabase
      .from('conversations')
      .update({ status: 'closed' })
      .eq('id', selectedConversation.id);

    if (error) {
      toast.error('Erro ao encerrar conversa');
    } else {
      toast.success('Conversa encerrada');
      setSelectedConversation(null);
      loadConversations();
    }
  };

  const handleImageClick = (imageUrl: string) => {
    setSelectedImageUrl(imageUrl);
    setImageModalOpen(true);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversation) return;

    // Validar número do cliente antes de fazer upload/envio
    if (!isValidPhoneNumber(selectedConversation.customer_phone)) {
      toast.error('Número inválido ou sem WhatsApp. Verifique o telefone do cliente.');
      return;
    }

    // Validar tamanho do arquivo (16MB máximo para WhatsApp)
    const maxSize = 16 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('Arquivo muito grande. O tamanho máximo é 16MB.');
      return;
    }

    setUploadingFile(true);
    try {
      // Upload para o Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath);

      // Determinar tipo de mídia
      let mediaType = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';
      else if (file.type.startsWith('video/')) mediaType = 'video';
      else if (file.type.startsWith('audio/')) mediaType = 'audio';

      // Enviar via WhatsApp usando a Evolution API diretamente
      const evolutionApiUrl = import.meta.env.VITE_SUPABASE_URL?.replace('supabase.co', 'supabase.co');
      
      // Preparar payload baseado no tipo de mídia
      let mediaPayload: any = {
        number: selectedConversation.customer_phone,
      };

      if (mediaType === 'image') {
        mediaPayload.mediaMessage = {
          mediatype: 'image',
          media: publicUrl
        };
      } else if (mediaType === 'video') {
        mediaPayload.mediaMessage = {
          mediatype: 'video',
          media: publicUrl
        };
      } else if (mediaType === 'audio') {
        mediaPayload.audioMessage = {
          audio: publicUrl
        };
      } else {
        mediaPayload.mediaMessage = {
          mediatype: 'document',
          media: publicUrl,
          fileName: file.name
        };
      }

      // Chamar edge function para enviar mídia via WhatsApp
      const { data: sendData, error: sendError } = await supabase.functions.invoke('whatsapp-send-media', {
        body: {
          phone: selectedConversation.customer_phone,
          mediaUrl: publicUrl,
          mediaType: mediaType,
          fileName: file.name,
          caption: ''
        }
      });

      if (sendError) {
        console.error('Erro ao enviar mídia:', sendError);
        const serverMsg = (sendData as any)?.message as string | undefined;
        toast.error(serverMsg || 'Erro ao enviar arquivo. O número pode não ter WhatsApp ou está inválido.');
        throw sendError;
      }

      // Salvar mensagem no banco
      const { error: dbError } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation.id,
          sender_type: 'operator',
          sender_name: 'Operador',
          message_text: mediaType === 'image' ? '[Imagem]' : mediaType === 'audio' ? '[Áudio]' : `[${file.name}]`,
          message_status: 'sent',
          media_type: mediaType,
          media_url: publicUrl
        });

      if (dbError) throw dbError;

      // Atualizar última mensagem da conversa
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selectedConversation.id);

      toast.success('Arquivo enviado com sucesso!');
      
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleEditPhone = () => {
    if (!selectedConversation) return;
    setEditingPhone(selectedConversation.customer_phone);
    setEditPhoneDialogOpen(true);
  };

  const saveEditedPhone = async () => {
    if (!selectedConversation || !editingPhone.trim()) return;

    const normalized = normalizePhone(editingPhone);
    
    if (!normalized || normalized.length < 10) {
      toast.error('Número de telefone inválido');
      return;
    }

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ customer_phone: normalized })
        .eq('id', selectedConversation.id);

      if (error) throw error;

      toast.success('Telefone atualizado com sucesso!');
      setEditPhoneDialogOpen(false);
      loadConversations();
      
      // Atualizar conversa selecionada
      setSelectedConversation({ ...selectedConversation, customer_phone: normalized });
    } catch (error) {
      console.error('Error updating phone:', error);
      toast.error('Erro ao atualizar telefone');
    }
  };

  const createNewConversation = async () => {
    if (!newConversationPhone.trim()) {
      toast.error('Digite um número de telefone');
      return;
    }

    const normalized = normalizePhone(newConversationPhone);
    
    if (!normalized || normalized.length < 10) {
      toast.error('Número de telefone inválido');
      return;
    }

    if (!isValidPhoneNumber(normalized)) {
      toast.error('Formato de número inválido. Use DDD + número (ex: 11987654321)');
      return;
    }

    setCreatingConversation(true);
    try {
      // Verificar se já existe conversa com este número
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('customer_phone', normalized)
        .maybeSingle();

      if (existingConv) {
        toast.info('Conversa já existe com este número');
        setSelectedConversation(existingConv);
        setNewConversationDialogOpen(false);
        setNewConversationPhone("");
        setNewConversationName("");
        setCreatingConversation(false);
        return;
      }

      // Criar nova conversa
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          customer_phone: normalized,
          customer_name: newConversationName.trim() || null,
          status: 'active',
          last_message_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Conversa criada! Você já pode enviar mensagens.');
      setNewConversationDialogOpen(false);
      setNewConversationPhone("");
      setNewConversationName("");
      loadConversations();
      setSelectedConversation(newConv);
    } catch (error) {
      console.error('Error creating conversation:', error);
      toast.error('Erro ao criar conversa');
    } finally {
      setCreatingConversation(false);
    }
  };

  return (
    <div className="grid md:grid-cols-3 gap-4 h-[calc(100vh-200px)] min-h-0">
      {/* Lista de conversas */}
      <Card className="p-4 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Conversas</h3>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setNewConversationDialogOpen(true)}
            title="Iniciar nova conversa"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "active" | "archived")} className="flex flex-col h-full min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="active" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Ativas
              <Badge variant="secondary">{conversations.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-2">
              <Archive className="h-4 w-4" />
              Antigas
              <Badge variant="secondary">{archivedConversations.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-4">
                  Nenhuma conversa ativa
                </p>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-2 rounded-lg cursor-pointer mb-1 transition-colors relative ${
                      selectedConversation?.id === conv.id
                        ? 'bg-primary/10'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm">{conv.customer_name || conv.customer_phone}</div>
                          {conv.unread_count > 0 && (
                            <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1">
                              {conv.unread_count}
                            </Badge>
                          )}
                          {conv.tags?.includes('reagendar') && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs h-5">
                              Reagendar
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {conv.customer_phone}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(conv.last_message_at), {
                            addSuffix: true,
                            locale: ptBR
                          })}
                        </div>
                      </div>
                      {conv.unread_count > 0 && (
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="archived" className="mt-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? (
                <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : archivedConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-4">
                  Nenhuma conversa arquivada
                </p>
              ) : (
                archivedConversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`p-2 rounded-lg cursor-pointer mb-1 transition-colors ${
                      selectedConversation?.id === conv.id
                        ? 'bg-primary/10'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedConversation(conv)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="font-medium text-sm">{conv.customer_name || conv.customer_phone}</div>
                        {conv.tags?.includes('reagendado') && (
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs h-5">
                            Reagendado
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {conv.customer_phone}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(conv.last_message_at), {
                          addSuffix: true,
                          locale: ptBR
                        })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Área de chat */}
      <Card className="md:col-span-2 p-4 flex flex-col h-full min-h-0 overflow-hidden">
        {selectedConversation ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3 flex-1">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {selectedConversation.customer_name || selectedConversation.customer_phone}
                    </h3>
                    {selectedConversation.tags?.includes('reagendar') && (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs">
                        Reagendar
                      </Badge>
                    )}
                    {selectedConversation.tags?.includes('reagendado') && (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                        Reagendado
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation.customer_phone}
                  </p>
                </div>
                
              </div>
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setOrdersDialogOpen(true)}>
                      Ver Pedidos
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={handleEditPhone}
                      disabled={isValidPhoneNumber(selectedConversation.customer_phone)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Telefone
                     </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {selectedConversation.tags?.includes('reagendar') && (
                  <Button
                    onClick={async () => {
                      if (!selectedConversation) return;
                      
                      const currentTags = selectedConversation.tags || [];
                      const updatedTags = currentTags.filter(tag => tag !== 'reagendar');
                      updatedTags.push('reagendado');
                      
                      await supabase
                        .from('conversations')
                        .update({ 
                          status: 'archived',
                          tags: updatedTags
                        })
                        .eq('id', selectedConversation.id);
                      
                      toast.success('Conversa reagendada e encerrada');
                      setSelectedConversation(null);
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Reagendado
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={closeConversation}>
                  <X className="h-4 w-4 mr-2" />
                  Encerrar
                </Button>
              </div>
            </div>
            <Separator className="mb-4" />
            
            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div className="space-y-4 pb-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`mb-4 ${
                      msg.sender_type === 'operator' ? 'text-right' : 'text-left'
                    }`}
                  >
                    <div
                      className={`inline-block p-3 rounded-lg max-w-[70%] break-words ${
                        msg.sender_type === 'operator'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {/* Imagem */}
                      {msg.media_type === 'image' && msg.media_url && (
                        <div className="mb-2">
                          <img 
                            src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`}
                            alt="Imagem enviada" 
                            loading="lazy"
                            className="rounded max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => handleImageClick(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`)}
                            onError={(e) => {
                              console.error('Erro ao carregar imagem:', msg.media_url);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}

                      {/* Sticker */}
                      {msg.media_type === 'sticker' && msg.media_url && (
                        <div className="mb-2">
                          <img 
                            src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`}
                            alt="Sticker" 
                            loading="lazy"
                            className="rounded max-w-[200px] max-h-[200px] object-contain cursor-pointer hover:opacity-90 transition-opacity bg-transparent"
                            onClick={() => handleImageClick(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`)}
                            onError={(e) => {
                              console.error('Erro ao carregar sticker:', msg.media_url);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      {/* Áudio */}
                      {msg.media_type === 'audio' && msg.media_url && (
                        <div className="mb-2">
                          <AudioPlayer 
                            src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`}
                            isOperator={msg.sender_type === 'operator'}
                          />
                        </div>
                      )}

                      {/* Vídeo */}
                      {msg.media_type === 'video' && msg.media_url && (
                        <div className="mb-2">
                          <video 
                            controls 
                            className="rounded max-w-full max-h-64"
                            preload="metadata"
                            onError={(e) => {
                              console.error('Erro ao carregar vídeo:', msg.media_url);
                            }}
                          >
                            <source 
                              src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`} 
                              type="video/mp4" 
                            />
                            Seu navegador não suporta vídeo.
                          </video>
                        </div>
                      )}

                      {/* Documento */}
                      {msg.media_type === 'document' && msg.media_url && (
                        <div className="mb-2">
                          <a 
                            href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm underline hover:opacity-80 transition-opacity bg-black/10 dark:bg-white/10 p-3 rounded"
                          >
                            <span className="text-2xl">📄</span>
                            <span>Visualizar documento</span>
                          </a>
                        </div>
                      )}
                      
                      {msg.message_text && 
                       msg.message_text !== '[Audio]' && 
                       msg.message_text !== '[Áudio]' && 
                       msg.message_text !== '[Imagem]' && 
                       msg.message_text !== '[Image]' && (
                        <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {formatMessageTimestamp(msg.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="flex gap-2 mt-4">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile || sending}
                title="Anexar arquivo"
              >
                {uploadingFile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Paperclip className="h-4 w-4" />
                )}
              </Button>
              <Input
                placeholder="Digite sua mensagem..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <Button onClick={sendMessage} disabled={sending || uploadingFile || !messageText.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecione uma conversa para começar
          </div>
        )}
      </Card>

      <ImageModal 
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        imageUrl={selectedImageUrl}
      />

      <CustomerOrdersDialog
        open={ordersDialogOpen}
        onOpenChange={setOrdersDialogOpen}
        customerPhone={selectedConversation?.customer_phone || ""}
        customerName={selectedConversation?.customer_name || undefined}
      />

      <Dialog open={editPhoneDialogOpen} onOpenChange={setEditPhoneDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Telefone do Cliente</DialogTitle>
            <DialogDescription>
              Atualize o número de telefone do cliente. O número será normalizado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="phone">Número de Telefone</Label>
              <Input
                id="phone"
                placeholder="(11) 98765-4321"
                value={editingPhone}
                onChange={(e) => setEditingPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && saveEditedPhone()}
              />
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: (11) 98765-4321, 11987654321, 5511987654321, +55 11 98765-4321
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPhoneDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEditedPhone}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newConversationDialogOpen} onOpenChange={setNewConversationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar Nova Conversa</DialogTitle>
            <DialogDescription>
              Digite o número de telefone do cliente para iniciar uma conversa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="new-phone">Número de Telefone *</Label>
              <Input
                id="new-phone"
                placeholder="(11) 98765-4321"
                value={newConversationPhone}
                onChange={(e) => setNewConversationPhone(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !creatingConversation && createNewConversation()}
              />
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: (11) 98765-4321, 11987654321, 5511987654321, +55 11 98765-4321
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-name">Nome do Cliente (opcional)</Label>
              <Input
                id="new-name"
                placeholder="João Silva"
                value={newConversationName}
                onChange={(e) => setNewConversationName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !creatingConversation && createNewConversation()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setNewConversationDialogOpen(false);
                setNewConversationPhone("");
                setNewConversationName("");
              }}
              disabled={creatingConversation}
            >
              Cancelar
            </Button>
            <Button onClick={createNewConversation} disabled={creatingConversation}>
              {creatingConversation ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Conversa'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}