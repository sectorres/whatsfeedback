import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Phone, MessageCircle, Calendar as CalendarIcon, Send, X, Package, Plus, Search, MoreVertical, Archive, Clock, Paperclip, Loader2, Edit, Calendar, CheckCircle2 } from 'lucide-react';
import { toast } from "sonner";
import { formatDistanceToNow, format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ImageModal } from "@/components/ImageModal";
import { isValidPhoneNumber, normalizePhone } from "@/lib/phone-utils";
import { CustomerOrdersDialog } from "@/components/CustomerOrdersDialog";
import { OrderDetailsDialog } from "@/components/OrderDetailsDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  profile_picture_url?: string | null;
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
interface Reschedule {
  id: string;
  scheduled_date: string;
  status: string;
  campaign_send_id: string | null;
  notes: string | null;
  created_at: string;
}
interface CampaignSend {
  id: string;
  campaign_id: string;
  customer_phone: string;
  customer_name: string | null;
  message_sent: string;
  status: string;
  sent_at: string;
  pedido_numero: string | null;
  pedido_id: number | null;
  carga_id: number | null;
  valor_total: number | null;
  quantidade_itens: number | null;
  campaign_responses?: Array<{
    id: string;
    response_type: string;
    responded_at: string;
  }>;
}
export function ConversationsPanel({
  isOnAtendimentoTab
}: {
  isOnAtendimentoTab: boolean;
}) {
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
  const [reschedules, setReschedules] = useState<Reschedule[]>([]);
  const [campaignSends, setCampaignSends] = useState<CampaignSend[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [selectedOrderNumero, setSelectedOrderNumero] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  useEffect(() => {
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;
    audioRef.current.load();
  }, []);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
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
    const conversationsChannel = supabase.channel('conversations-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conversations'
    }, () => {
      loadConversations();
    }).subscribe();

    // Realtime para todas as mensagens (notificação sonora)
    const allMessagesChannel = supabase.channel('all-messages-notification').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, payload => {
      console.log('Nova mensagem recebida:', {
        sender_type: payload.new.sender_type,
        isOnAtendimentoTab,
        shouldPlaySound: payload.new.sender_type === 'customer' && !isOnAtendimentoTab
      });

      // Tocar notificação sonora se for mensagem de cliente E não estiver na aba de atendimento
      if (payload.new.sender_type === 'customer' && !isOnAtendimentoTab) {
        console.log('Tentando tocar notificação...');
        if (audioRef.current) {
          audioRef.current.play().then(() => console.log('Notificação tocada com sucesso')).catch(err => {
            console.error('Erro ao tocar notificação:', err);
            // Tentar novamente com interação do usuário
            toast.error('Nova mensagem recebida! (Som bloqueado pelo navegador)');
          });
        }
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(allMessagesChannel);
    };
  }, [isOnAtendimentoTab]); // Adicionar dependência para recriar o listener quando a aba mudar

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      loadReschedules(selectedConversation.id);
      loadCampaignHistory(selectedConversation.customer_phone);

      // Marcar como lida ao abrir
      markAsRead(selectedConversation.id);

      // Realtime para mensagens da conversa selecionada
      const messagesChannel = supabase.channel(`messages-${selectedConversation.id}`).on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConversation.id}`
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
        // Incrementar contador de não lidas se for mensagem do cliente
        if (payload.new.sender_type === 'customer') {
          supabase.from('conversations').update({
            unread_count: selectedConversation.unread_count + 1
          }).eq('id', selectedConversation.id);
        }
      }).subscribe();
      return () => {
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [selectedConversation]);
  const loadConversations = async () => {
    // Remover loading para evitar "piscar" na interface
    const {
      data: activeData,
      error: activeError
    } = await supabase.from('conversations').select('*').eq('status', 'active').order('last_message_at', {
      ascending: false
    });
    const {
      data: archivedData,
      error: archivedError
    } = await supabase.from('conversations').select('*').eq('status', 'closed').order('last_message_at', {
      ascending: false
    });
    if (activeError) {
      console.error('Error loading active conversations:', activeError);
      toast.error('Erro ao carregar conversas ativas');
    } else {
      // Buscar fotos de perfil para as conversas ativas
      const conversationsWithPhotos = await Promise.all(
        (activeData || []).map(async (conv) => {
          try {
            const { data } = await supabase.functions.invoke('fetch-profile-picture', {
              body: { phone: conv.customer_phone }
            });
            return {
              ...conv,
              profile_picture_url: data?.profilePictureUrl || null
            };
          } catch (error) {
            console.error('Error fetching profile picture:', error);
            return conv;
          }
        })
      );
      setConversations(conversationsWithPhotos);
    }
    if (archivedError) {
      console.error('Error loading archived conversations:', archivedError);
    } else {
      // Buscar fotos de perfil para as conversas arquivadas
      const conversationsWithPhotos = await Promise.all(
        (archivedData || []).map(async (conv) => {
          try {
            const { data } = await supabase.functions.invoke('fetch-profile-picture', {
              body: { phone: conv.customer_phone }
            });
            return {
              ...conv,
              profile_picture_url: data?.profilePictureUrl || null
            };
          } catch (error) {
            console.error('Error fetching profile picture:', error);
            return conv;
          }
        })
      );
      setArchivedConversations(conversationsWithPhotos);
    }
  };
  const loadReschedules = async (conversationId: string) => {
    const {
      data,
      error
    } = await supabase.from('reschedules').select('*').eq('conversation_id', conversationId).order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error loading reschedules:', error);
    } else {
      setReschedules(data || []);
    }
  };
  const loadCampaignHistory = async (customerPhone: string) => {
    const {
      data,
      error
    } = await supabase.from('campaign_sends').select(`
      id, campaign_id, customer_phone, customer_name, message_sent, status, sent_at, 
      pedido_numero, pedido_id, carga_id, valor_total, quantidade_itens,
      campaign_responses (
        id, response_type, responded_at
      )
    `).eq('customer_phone', customerPhone).order('sent_at', {
      ascending: false
    });
    if (error) {
      console.error('Error loading campaign history:', error);
    } else {
      setCampaignSends(data || []);
    }
  };
  const loadMessages = async (conversationId: string) => {
    const {
      data,
      error
    } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', {
      ascending: true
    });
    if (error) {
      console.error('Error loading messages:', error);
      toast.error('Erro ao carregar mensagens');
    } else {
      setMessages(data || []);
      // Scroll para o final após carregar mensagens
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  };
  const markAsRead = async (conversationId: string) => {
    await supabase.from('conversations').update({
      unread_count: 0,
      last_read_at: new Date().toISOString()
    }).eq('id', conversationId);

    // Atualizar lista local
    setConversations(prev => prev.map(conv => conv.id === conversationId ? {
      ...conv,
      unread_count: 0,
      last_read_at: new Date().toISOString()
    } : conv));
  };
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editText, setEditText] = useState("");

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;
    setSending(true);
    
    // Criar ID único para evitar duplicatas
    const messageId = crypto.randomUUID();
    
    try {
      // Preparar dados da mensagem
      const messageData: any = {
        id: messageId,
        conversation_id: selectedConversation.id,
        sender_type: 'operator',
        sender_name: 'Operador',
        message_text: messageText,
        message_status: 'sending'
      };

      // Se for uma resposta, adicionar replied_to_id
      if (replyingTo) {
        messageData.replied_to_id = replyingTo.id;
      }

      // Salvar mensagem no banco ANTES de enviar (para aparecer imediatamente)
      const { error: dbError } = await supabase.from('messages').insert(messageData);
      if (dbError) throw dbError;

      // Preparar payload para Evolution API
      const sendPayload: any = {
        phone: selectedConversation.customer_phone,
        message: messageText,
        conversation_id: selectedConversation.id,
        skip_message_save: true
      };

      // Adicionar replied_to_id se for uma resposta
      if (replyingTo) {
        sendPayload.replied_to_id = replyingTo.whatsapp_message_id || replyingTo.id;
      }

      // Enviar via Evolution API (não cria mensagem no banco)
      const response = await supabase.functions.invoke('whatsapp-send', {
        body: sendPayload
      });
      
      if (response.error) {
        // Atualizar status para erro
        await supabase.from('messages')
          .update({ message_status: 'failed' })
          .eq('id', messageId);
        throw response.error;
      }

      // Atualizar status para enviada e salvar whatsapp_message_id
      const responseData = response.data as any;
      await supabase.from('messages')
        .update({ 
          message_status: 'sent',
          whatsapp_message_id: responseData?.key?.id
        })
        .eq('id', messageId);

      // Atualizar última mensagem da conversa
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString()
      }).eq('id', selectedConversation.id);
      
      setMessageText("");
      setReplyingTo(null);
      toast.success('Mensagem enviada!');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleEditMessage = async (message: any) => {
    if (!editText.trim()) return;

    try {
      const response = await supabase.functions.invoke('whatsapp-edit-message', {
        body: {
          messageId: message.id,
          newText: editText
        }
      });

      if (response.error) throw response.error;

      toast.success('Mensagem editada!');
      setEditingMessage(null);
      setEditText("");
      loadMessages(selectedConversation!.id);
    } catch (error) {
      console.error('Error editing message:', error);
      toast.error('Erro ao editar mensagem');
    }
  };

  const handleDeleteMessage = async (message: any) => {
    if (!confirm('Tem certeza que deseja apagar esta mensagem?')) return;

    try {
      const response = await supabase.functions.invoke('whatsapp-delete-message', {
        body: {
          messageId: message.id,
          conversationId: selectedConversation!.id
        }
      });

      if (response.error) throw response.error;

      toast.success('Mensagem apagada!');
      loadMessages(selectedConversation!.id);
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erro ao apagar mensagem');
    }
  };
  const closeConversation = async () => {
    if (!selectedConversation) return;
    const {
      error
    } = await supabase.from('conversations').update({
      status: 'closed'
    }).eq('id', selectedConversation.id);
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
      const {
        error: uploadError,
        data
      } = await supabase.storage.from('whatsapp-media').upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
      if (uploadError) throw uploadError;

      // Obter URL pública
      const {
        data: {
          publicUrl
        }
      } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath);

      // Determinar tipo de mídia
      let mediaType = 'document';
      if (file.type.startsWith('image/')) mediaType = 'image';else if (file.type.startsWith('video/')) mediaType = 'video';else if (file.type.startsWith('audio/')) mediaType = 'audio';

      // Enviar via WhatsApp usando a Evolution API diretamente
      const evolutionApiUrl = import.meta.env.VITE_SUPABASE_URL?.replace('supabase.co', 'supabase.co');

      // Preparar payload baseado no tipo de mídia
      let mediaPayload: any = {
        number: selectedConversation.customer_phone
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
      const {
        data: sendData,
        error: sendError
      } = await supabase.functions.invoke('whatsapp-send-media', {
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

      // Salvar mensagem no banco com whatsapp_message_id
      const { error: dbError } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        sender_type: 'operator',
        sender_name: 'Operador',
        message_text: mediaType === 'image' ? '[Imagem]' : mediaType === 'audio' ? '[Áudio]' : `[${file.name}]`,
        message_status: 'sent',
        media_type: mediaType,
        media_url: publicUrl,
        whatsapp_message_id: sendData?.data?.key?.id
      });
      if (dbError) throw dbError;

      // Atualizar última mensagem da conversa
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString()
      }).eq('id', selectedConversation.id);
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
      const {
        error
      } = await supabase.from('conversations').update({
        customer_phone: normalized
      }).eq('id', selectedConversation.id);
      if (error) throw error;
      toast.success('Telefone atualizado com sucesso!');
      setEditPhoneDialogOpen(false);
      loadConversations();

      // Atualizar conversa selecionada
      setSelectedConversation({
        ...selectedConversation,
        customer_phone: normalized
      });
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
      const {
        data: existingConv
      } = await supabase.from('conversations').select('*').eq('customer_phone', normalized).maybeSingle();
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
      const {
        data: newConv,
        error
      } = await supabase.from('conversations').insert({
        customer_phone: normalized,
        customer_name: newConversationName.trim() || null,
        status: 'active',
        last_message_at: new Date().toISOString()
      }).select().single();
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
  return <div className="grid gap-4 h-[calc(100vh-220px)] min-h-0" style={{
    gridTemplateColumns: "300px 1fr 320px"
  }}>
      {/* Lista de conversas */}
      <Card className="p-4 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Conversas</h3>
          <Button variant="outline" size="icon" onClick={() => setNewConversationDialogOpen(true)} title="Iniciar nova conversa">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <Input
          placeholder="Buscar por nome ou telefone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="mb-2"
        />
        <Tabs value={activeTab} onValueChange={value => setActiveTab(value as "active" | "archived")} className="flex flex-col h-full min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-2">
            <TabsTrigger value="active" className="gap-1 text-xs">
              <MessageCircle className="h-3 w-3" />
              Ativas
              <Badge variant="secondary" className="text-xs">{conversations.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="archived" className="gap-1 text-xs">
              <Archive className="h-3 w-3" />
              Antigas
              <Badge variant="secondary" className="text-xs">{archivedConversations.length}</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div> : conversations.filter(conv => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    conv.customer_name?.toLowerCase().includes(query) ||
                    conv.customer_phone.includes(query)
                  );
                }).length === 0 ? <p className="text-sm text-muted-foreground text-center p-4">
                  Nenhuma conversa ativa
                </p> : conversations.filter(conv => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    conv.customer_name?.toLowerCase().includes(query) ||
                    conv.customer_phone.includes(query)
                  );
                }).map(conv => <div key={conv.id} className={`p-2 rounded-lg cursor-pointer mb-1 transition-colors relative ${selectedConversation?.id === conv.id ? 'bg-primary/10' : 'hover:bg-muted'}`} onClick={() => setSelectedConversation(conv)}>
                    <div className="flex items-start gap-2">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {conv.profile_picture_url && <AvatarImage src={conv.profile_picture_url} alt={conv.customer_name || conv.customer_phone} />}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {conv.customer_name ? conv.customer_name.substring(0, 2).toUpperCase() : conv.customer_phone.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm truncate">{conv.customer_name || conv.customer_phone}</div>
                          {conv.unread_count > 0 && <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1">
                              {conv.unread_count}
                            </Badge>}
                          {conv.tags?.includes('reagendar') && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30 text-xs h-5">
                              Reagendar
                            </Badge>}
                          {conv.tags?.includes('confirmado')}
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
                      {conv.unread_count > 0 && <div className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />}
                    </div>
                  </div>)}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="archived" className="mt-0 flex-1 min-h-0">
            <ScrollArea className="h-full">
              {loading ? <div className="flex justify-center p-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div> : archivedConversations.filter(conv => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    conv.customer_name?.toLowerCase().includes(query) ||
                    conv.customer_phone.includes(query)
                  );
                }).length === 0 ? <p className="text-sm text-muted-foreground text-center p-4">
                  Nenhuma conversa arquivada
                </p> : archivedConversations.filter(conv => {
                  if (!searchQuery) return true;
                  const query = searchQuery.toLowerCase();
                  return (
                    conv.customer_name?.toLowerCase().includes(query) ||
                    conv.customer_phone.includes(query)
                  );
                }).map(conv => <div key={conv.id} className={`p-2 rounded-lg cursor-pointer mb-1 transition-colors ${selectedConversation?.id === conv.id ? 'bg-primary/10' : 'hover:bg-muted'}`} onClick={() => setSelectedConversation(conv)}>
                    <div className="flex items-start gap-2">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        {conv.profile_picture_url && <AvatarImage src={conv.profile_picture_url} alt={conv.customer_name || conv.customer_phone} />}
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {conv.customer_name ? conv.customer_name.substring(0, 2).toUpperCase() : conv.customer_phone.substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-medium text-sm truncate">{conv.customer_name || conv.customer_phone}</div>
                        {conv.tags?.includes('reagendado') && <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs h-5">
                            Reagendado
                          </Badge>}
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
                  </div>)}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Área de chat */}
      <Card className="p-4 flex flex-col h-full min-h-0 overflow-hidden">
        {selectedConversation ? <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">
                  {selectedConversation.customer_name || selectedConversation.customer_phone}
                </h3>
                <span className="text-sm text-muted-foreground">
                  {selectedConversation.customer_phone}
                </span>
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
                    <DropdownMenuItem onClick={handleEditPhone} disabled={isValidPhoneNumber(selectedConversation.customer_phone)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Editar Telefone
                     </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {selectedConversation.tags?.includes('reagendar') && <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="bg-blue-500/10 text-blue-600 border-blue-500/30 hover:bg-blue-500/20">
                        <Calendar className="h-4 w-4 mr-2" />
                        Reagendar
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent mode="single" selected={selectedDate} onSelect={date => {
                  setSelectedDate(date);
                  if (date && selectedConversation) {
                    const formattedDate = format(date, "dd/MM/yyyy", {
                      locale: ptBR
                    });
                    setMessageText(`Ok, seu reagendamento foi realizado para o dia ${formattedDate}`);
                    setCalendarOpen(false);
                  }
                }} disabled={date => date < new Date()} initialFocus />
                    </PopoverContent>
                  </Popover>}
                {selectedDate && selectedConversation.tags?.includes('reagendar') && <Button variant="outline" size="sm" className="bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20" onClick={async () => {
              if (!selectedConversation || !selectedDate) return;

              // Buscar última campanha do cliente
              const lastCampaign = campaignSends[0];

              // Inserir reagendamento
              const {
                error: rescheduleError
              } = await supabase.from('reschedules').insert({
                conversation_id: selectedConversation.id,
                campaign_send_id: lastCampaign?.id,
                customer_phone: selectedConversation.customer_phone,
                customer_name: selectedConversation.customer_name,
                scheduled_date: format(selectedDate, 'yyyy-MM-dd'),
                status: 'pending'
              });
              if (rescheduleError) {
                toast.error('Erro ao registrar reagendamento');
                return;
              }

              // Remover tag 'reagendar' e mudar status para 'rescheduled'
              const currentTags = selectedConversation.tags || [];
              const updatedTags = currentTags.filter(tag => tag !== 'reagendar');
              updatedTags.push('reagendado');
              await supabase.from('conversations').update({
                status: 'rescheduled',
                tags: updatedTags
              }).eq('id', selectedConversation.id);
              toast.success('Reagendamento confirmado!');
              setSelectedDate(undefined);
              loadConversations();
              loadReschedules(selectedConversation.id);
            }}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Confirmar Reagendamento
                  </Button>}
                <Button variant="outline" size="sm" onClick={closeConversation}>
                  <X className="h-4 w-4 mr-2" />
                  Encerrar
                </Button>
              </div>
            </div>
            <Separator className="mb-4" />

            {/* Histórico de Pedidos e Reagendamentos */}
            {(campaignSends.length > 0 || reschedules.length > 0) && <div className="mb-4 space-y-2">
                {campaignSends.length > 0}
                {reschedules.length > 0 && <div className="bg-muted/30 rounded-lg p-2">
                    <h4 className="text-xs font-semibold mb-2">Reagendamentos</h4>
                    <div className="space-y-1">
                      {reschedules.map(reschedule => <div key={reschedule.id} className="text-xs flex items-center gap-2">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                            {format(new Date(reschedule.scheduled_date), "dd/MM/yyyy", {
                    locale: ptBR
                  })}
                          </Badge>
                          <span className="text-muted-foreground">
                            {reschedule.status === 'pending' ? 'Pendente' : 'Confirmado'}
                          </span>
                        </div>)}
                    </div>
                  </div>}
              </div>}
            
            <ScrollArea className="flex-1 min-h-0 pr-4">
              <div className="space-y-4 pb-4">
                {messages.map(msg => <div key={msg.id} className={`mb-4 group ${msg.sender_type === 'operator' ? 'text-right' : 'text-left'}`}>
                    <div className={`inline-block p-3 rounded-lg max-w-[70%] break-words relative ${msg.sender_type === 'operator' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      {/* Imagem */}
                      {msg.media_type === 'image' && msg.media_url && <div className="mb-2">
                          <img src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`} alt="Imagem enviada" loading="lazy" className="rounded max-w-full max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity" onClick={() => handleImageClick(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`)} onError={e => {
                    console.error('Erro ao carregar imagem:', msg.media_url);
                    e.currentTarget.style.display = 'none';
                  }} />
                        </div>}
                      
                      {/* Sticker */}
                      {msg.media_type === 'sticker' && msg.media_url && <div className="mb-2">
                          <img src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`} alt="Sticker" loading="lazy" className="rounded max-w-[200px] max-h-[200px] object-contain cursor-pointer hover:opacity-90 transition-opacity bg-transparent" onClick={() => handleImageClick(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`)} onError={e => {
                    console.error('Erro ao carregar sticker:', msg.media_url);
                    e.currentTarget.style.display = 'none';
                  }} />
                        </div>}
                      
                      {/* Áudio */}
                      {msg.media_type === 'audio' && msg.media_url && <div className="mb-2">
                          <AudioPlayer src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`} isOperator={msg.sender_type === 'operator'} />
                        </div>}

                      {/* Vídeo */}
                      {msg.media_type === 'video' && msg.media_url && <div className="mb-2">
                          <video controls className="rounded max-w-full max-h-64" preload="metadata" onError={e => {
                    console.error('Erro ao carregar vídeo:', msg.media_url);
                  }}>
                            <source src={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`} type="video/mp4" />
                            Seu navegador não suporta vídeo.
                          </video>
                        </div>}

                      {/* Documento */}
                      {msg.media_type === 'document' && msg.media_url && <div className="mb-2">
                          <a href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-media-proxy?url=${encodeURIComponent(msg.media_url)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm underline hover:opacity-80 transition-opacity bg-black/10 dark:bg-white/10 p-3 rounded">
                            <span className="text-2xl">📄</span>
                            <span>Visualizar documento</span>
                          </a>
                        </div>}
                      
                      {msg.message_text && msg.message_text !== '[Audio]' && msg.message_text !== '[Áudio]' && msg.message_text !== '[Imagem]' && msg.message_text !== '[Image]' && <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>}
                      <p className="text-xs opacity-70 mt-1">
                        {formatMessageTimestamp(msg.created_at)}
                      </p>
                    </div>
                  </div>)}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            <div className="mt-4 space-y-2">
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />
                <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploadingFile || sending} title="Anexar arquivo">
                  {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </Button>
                <Input placeholder="Digite sua mensagem..." value={messageText} onChange={e => setMessageText(e.target.value)} onKeyPress={e => e.key === 'Enter' && sendMessage()} />
                <Button onClick={sendMessage} disabled={sending || uploadingFile || !messageText.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </> : <div className="flex items-center justify-center h-full text-muted-foreground">
            Selecione uma conversa para começar
          </div>}
      </Card>

      {/* Histórico de Pedidos - Coluna Lateral */}
      <Card className="p-0 flex flex-col h-full min-h-0 overflow-hidden">
        <div className="p-4 border-b bg-muted/50">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" />
            Histórico de Pedidos
          </h4>
        </div>
        <ScrollArea className="flex-1">
          {selectedConversation ? <div className="p-4">
              {campaignSends.length > 0 ? <div className="space-y-3">
                  {campaignSends.map(send => {
              const reschedule = reschedules.find(r => r.campaign_send_id === send.id);
              const isConfirmed = send.status === 'confirmed';
              const isRescheduleRequested = send.status === 'reschedule_requested';
              const confirmationResponse = send.campaign_responses?.find(r => r.response_type === 'confirmed');
              const confirmationDate = confirmationResponse?.responded_at || send.sent_at;
              return <div key={send.id} className="bg-background p-3 rounded-lg border space-y-2 cursor-pointer hover:bg-accent transition-colors" onClick={() => {
                if (send.pedido_numero) {
                  setSelectedOrderNumero(send.pedido_numero);
                  setOrderDialogOpen(true);
                }
              }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">{send.customer_name || 'Cliente'}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Pedido: {send.pedido_numero || 'Sem número'}
                            </div>
                          </div>
                          {isConfirmed && <Badge className="bg-green-500 hover:bg-green-600">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Confirmado
                            </Badge>}
                          {isRescheduleRequested && <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                              <Clock className="w-3 h-3 mr-1" />
                              Reagendar
                            </Badge>}
                          {reschedule && <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                              <Clock className="w-3 h-3 mr-1" />
                              Reagendado
                            </Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Enviado: {format(new Date(send.sent_at), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR
                  })}
                        </div>
                        {isConfirmed && <div className="text-xs text-green-600 font-medium">
                            Confirmado em: {format(new Date(confirmationDate), "dd/MM/yyyy 'às' HH:mm", {
                    locale: ptBR
                  })}
                          </div>}
                        {reschedule && <div className="text-xs text-blue-600 font-medium">
                            Reagendado para: {format(new Date(reschedule.scheduled_date), "dd/MM/yyyy", {
                    locale: ptBR
                  })}
                          </div>}
                        {send.valor_total && <div className="text-xs text-muted-foreground">
                            Valor: R$ {send.valor_total.toFixed(2)}
                          </div>}
                        {send.quantidade_itens && <div className="text-xs text-muted-foreground">
                            {send.quantidade_itens} {send.quantidade_itens === 1 ? 'item' : 'itens'}
                          </div>}
                      </div>;
            })}
                </div> : <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum pedido encontrado
                </p>}
            </div> : <div className="flex items-center justify-center h-full text-muted-foreground p-4 text-center">
              <p className="text-sm">Selecione uma conversa para ver o histórico de pedidos</p>
            </div>}
        </ScrollArea>
      </Card>

      <ImageModal isOpen={imageModalOpen} onClose={() => setImageModalOpen(false)} imageUrl={selectedImageUrl} />

      <CustomerOrdersDialog open={ordersDialogOpen} onOpenChange={setOrdersDialogOpen} customerPhone={selectedConversation?.customer_phone || ""} customerName={selectedConversation?.customer_name || undefined} />

      <OrderDetailsDialog open={orderDialogOpen} onOpenChange={setOrderDialogOpen} pedidoNumero={selectedOrderNumero} />

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
              <Input id="phone" placeholder="(11) 98765-4321" value={editingPhone} onChange={e => setEditingPhone(e.target.value)} onKeyPress={e => e.key === 'Enter' && saveEditedPhone()} />
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
              <Input id="new-phone" placeholder="(11) 98765-4321" value={newConversationPhone} onChange={e => setNewConversationPhone(e.target.value)} onKeyPress={e => e.key === 'Enter' && !creatingConversation && createNewConversation()} />
              <p className="text-xs text-muted-foreground">
                Formatos aceitos: (11) 98765-4321, 11987654321, 5511987654321, +55 11 98765-4321
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-name">Nome do Cliente (opcional)</Label>
              <Input id="new-name" placeholder="João Silva" value={newConversationName} onChange={e => setNewConversationName(e.target.value)} onKeyPress={e => e.key === 'Enter' && !creatingConversation && createNewConversation()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
            setNewConversationDialogOpen(false);
            setNewConversationPhone("");
            setNewConversationName("");
          }} disabled={creatingConversation}>
              Cancelar
            </Button>
            <Button onClick={createNewConversation} disabled={creatingConversation}>
              {creatingConversation ? <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </> : 'Criar Conversa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}