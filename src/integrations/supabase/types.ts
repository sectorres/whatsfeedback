export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_config: {
        Row: {
          config_key: string
          created_at: string
          id: string
          prompt: string
          updated_at: string
        }
        Insert: {
          config_key: string
          created_at?: string
          id?: string
          prompt: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          created_at?: string
          id?: string
          prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_trigger_phrases: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          match_type: string
          phrase: string
          response: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_type?: string
          phrase: string
          response: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          match_type?: string
          phrase?: string
          response?: string
          updated_at?: string
        }
        Relationships: []
      }
      allowed_ips: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ip_address: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ip_address: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_config: {
        Row: {
          config_key: string
          config_value: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      automatic_template_sends: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string
          data_pedido: string | null
          id: string
          pedido_id: number
          pedido_numero: string
          sent_at: string
          status_triggered: string
          template_sent: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          data_pedido?: string | null
          id?: string
          pedido_id: number
          pedido_numero: string
          sent_at?: string
          status_triggered: string
          template_sent: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          data_pedido?: string | null
          id?: string
          pedido_id?: number
          pedido_numero?: string
          sent_at?: string
          status_triggered?: string
          template_sent?: string
        }
        Relationships: []
      }
      blacklist: {
        Row: {
          added_at: string
          created_at: string
          id: string
          phone: string
          reason: string | null
          updated_at: string
        }
        Insert: {
          added_at?: string
          created_at?: string
          id?: string
          phone: string
          reason?: string | null
          updated_at?: string
        }
        Update: {
          added_at?: string
          created_at?: string
          id?: string
          phone?: string
          reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_responses: {
        Row: {
          campaign_send_id: string | null
          conversation_id: string
          created_at: string
          id: string
          responded_at: string
          response_type: string
        }
        Insert: {
          campaign_send_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          responded_at?: string
          response_type: string
        }
        Update: {
          campaign_send_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          responded_at?: string
          response_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_responses_campaign_send_id_fkey"
            columns: ["campaign_send_id"]
            isOneToOne: false
            referencedRelation: "campaign_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_responses_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sends: {
        Row: {
          bairro: string | null
          campaign_id: string
          carga_id: number | null
          cep: string | null
          cidade: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string
          data_pedido: string | null
          driver_name: string | null
          endereco_completo: string | null
          error_message: string | null
          estado: string | null
          id: string
          message_sent: string
          nota_fiscal: string | null
          pedido_id: number | null
          pedido_numero: string | null
          peso_total: number | null
          produtos: Json | null
          quantidade_entregas: number | null
          quantidade_itens: number | null
          quantidade_skus: number | null
          referencia: string | null
          rota: string | null
          sent_at: string
          status: string
          valor_total: number | null
        }
        Insert: {
          bairro?: string | null
          campaign_id: string
          carga_id?: number | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          data_pedido?: string | null
          driver_name?: string | null
          endereco_completo?: string | null
          error_message?: string | null
          estado?: string | null
          id?: string
          message_sent: string
          nota_fiscal?: string | null
          pedido_id?: number | null
          pedido_numero?: string | null
          peso_total?: number | null
          produtos?: Json | null
          quantidade_entregas?: number | null
          quantidade_itens?: number | null
          quantidade_skus?: number | null
          referencia?: string | null
          rota?: string | null
          sent_at?: string
          status?: string
          valor_total?: number | null
        }
        Update: {
          bairro?: string | null
          campaign_id?: string
          carga_id?: number | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          data_pedido?: string | null
          driver_name?: string | null
          endereco_completo?: string | null
          error_message?: string | null
          estado?: string | null
          id?: string
          message_sent?: string
          nota_fiscal?: string | null
          pedido_id?: number | null
          pedido_numero?: string | null
          peso_total?: number | null
          produtos?: Json | null
          quantidade_entregas?: number | null
          quantidade_itens?: number | null
          quantidade_skus?: number | null
          referencia?: string | null
          rota?: string | null
          sent_at?: string
          status?: string
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          id: string
          message: string
          name: string
          scheduled_at: string | null
          sent_count: number | null
          status: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          name: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          name?: string
          scheduled_at?: string | null
          sent_count?: number | null
          status?: string
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          ai_active: boolean | null
          assigned_to: string | null
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          last_message_at: string
          last_read_at: string | null
          profile_picture_url: string | null
          status: string
          tags: string[] | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          ai_active?: boolean | null
          assigned_to?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          last_message_at?: string
          last_read_at?: string | null
          profile_picture_url?: string | null
          status?: string
          tags?: string[] | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          ai_active?: boolean | null
          assigned_to?: string | null
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          last_message_at?: string
          last_read_at?: string | null
          profile_picture_url?: string | null
          status?: string
          tags?: string[] | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      delivered_orders: {
        Row: {
          bairro: string | null
          carga_id: number | null
          cidade: string | null
          created_at: string | null
          customer_name: string | null
          customer_phone: string
          data_entrega: string | null
          detected_at: string | null
          driver_name: string | null
          endereco_completo: string | null
          estado: string | null
          id: string
          observacao: string | null
          pedido_id: number
          pedido_numero: string
          peso_total: number | null
          produtos: Json | null
          quantidade_itens: number | null
          referencia: string | null
          status: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          bairro?: string | null
          carga_id?: number | null
          cidade?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone: string
          data_entrega?: string | null
          detected_at?: string | null
          driver_name?: string | null
          endereco_completo?: string | null
          estado?: string | null
          id?: string
          observacao?: string | null
          pedido_id: number
          pedido_numero: string
          peso_total?: number | null
          produtos?: Json | null
          quantidade_itens?: number | null
          referencia?: string | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          bairro?: string | null
          carga_id?: number | null
          cidade?: string | null
          created_at?: string | null
          customer_name?: string | null
          customer_phone?: string
          data_entrega?: string | null
          detected_at?: string | null
          driver_name?: string | null
          endereco_completo?: string | null
          estado?: string | null
          id?: string
          observacao?: string | null
          pedido_id?: number
          pedido_numero?: string
          peso_total?: number | null
          produtos?: Json | null
          quantidade_itens?: number | null
          referencia?: string | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      evolution_api_config: {
        Row: {
          api_key: string | null
          api_url: string | null
          config_type: string
          created_at: string
          id: string
          instance_name: string | null
          is_active: boolean
          survey_template_language: string | null
          survey_template_name: string | null
          template_language: string | null
          template_name: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          config_type?: string
          created_at?: string
          id?: string
          instance_name?: string | null
          is_active?: boolean
          survey_template_language?: string | null
          survey_template_name?: string | null
          template_language?: string | null
          template_name?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          config_type?: string
          created_at?: string
          id?: string
          instance_name?: string | null
          is_active?: boolean
          survey_template_language?: string | null
          survey_template_name?: string | null
          template_language?: string | null
          template_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          media_description: string | null
          media_transcription: string | null
          media_type: string | null
          media_url: string | null
          message_status: string | null
          message_text: string
          replied_to_id: string | null
          sender_name: string | null
          sender_type: string
          whatsapp_message_id: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_description?: string | null
          media_transcription?: string | null
          media_type?: string | null
          media_url?: string | null
          message_status?: string | null
          message_text: string
          replied_to_id?: string | null
          sender_name?: string | null
          sender_type: string
          whatsapp_message_id?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_description?: string | null
          media_transcription?: string | null
          media_type?: string | null
          media_url?: string | null
          message_status?: string | null
          message_text?: string
          replied_to_id?: string | null
          sender_name?: string | null
          sender_type?: string
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_replied_to_id_fkey"
            columns: ["replied_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      reschedules: {
        Row: {
          campaign_send_id: string | null
          confirmed_at: string | null
          conversation_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          id: string
          notes: string | null
          scheduled_date: string
          status: string
          updated_at: string
        }
        Insert: {
          campaign_send_id?: string | null
          confirmed_at?: string | null
          conversation_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          id?: string
          notes?: string | null
          scheduled_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_send_id?: string | null
          confirmed_at?: string | null
          conversation_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          id?: string
          notes?: string | null
          scheduled_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reschedules_campaign_send_id_fkey"
            columns: ["campaign_send_id"]
            isOneToOne: false
            referencedRelation: "campaign_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reschedules_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_insights: {
        Row: {
          average_rating: number | null
          campaign_id: string | null
          created_at: string
          date_from: string | null
          date_to: string | null
          generated_at: string
          id: string
          insights: string | null
          rating_distribution: Json | null
          sentiment_summary: string | null
          total_responses: number
        }
        Insert: {
          average_rating?: number | null
          campaign_id?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          generated_at?: string
          id?: string
          insights?: string | null
          rating_distribution?: Json | null
          sentiment_summary?: string | null
          total_responses?: number
        }
        Update: {
          average_rating?: number | null
          campaign_id?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          generated_at?: string
          id?: string
          insights?: string | null
          rating_distribution?: Json | null
          sentiment_summary?: string | null
          total_responses?: number
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_insights_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      satisfaction_surveys: {
        Row: {
          campaign_send_id: string
          created_at: string
          customer_name: string | null
          customer_phone: string
          feedback: string | null
          id: string
          rating: number | null
          responded_at: string | null
          sent_at: string
          status: string
          updated_at: string
        }
        Insert: {
          campaign_send_id: string
          created_at?: string
          customer_name?: string | null
          customer_phone: string
          feedback?: string | null
          id?: string
          rating?: number | null
          responded_at?: string | null
          sent_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_send_id?: string
          created_at?: string
          customer_name?: string | null
          customer_phone?: string
          feedback?: string | null
          id?: string
          rating?: number | null
          responded_at?: string | null
          sent_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_campaign_send_id_fkey"
            columns: ["campaign_send_id"]
            isOneToOne: true
            referencedRelation: "campaign_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_send_runs: {
        Row: {
          campaign_id: string | null
          cancelled_at: string | null
          created_at: string
          id: string
          started_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          started_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_modules: {
        Row: {
          created_at: string
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          approved_at: string | null
          body_text: string
          category: string
          created_at: string
          footer_text: string | null
          header_text: string | null
          id: string
          is_disabled: boolean
          language: string
          meta_rejection_reason: string | null
          meta_status: string | null
          meta_template_id: string | null
          submitted_at: string | null
          template_name: string
          template_type: string
          updated_at: string
          variables: Json | null
        }
        Insert: {
          approved_at?: string | null
          body_text: string
          category: string
          created_at?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_disabled?: boolean
          language?: string
          meta_rejection_reason?: string | null
          meta_status?: string | null
          meta_template_id?: string | null
          submitted_at?: string | null
          template_name: string
          template_type?: string
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          approved_at?: string | null
          body_text?: string
          category?: string
          created_at?: string
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_disabled?: boolean
          language?: string
          meta_rejection_reason?: string | null
          meta_status?: string | null
          meta_template_id?: string | null
          submitted_at?: string | null
          template_name?: string
          template_type?: string
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_module_access: {
        Args: {
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_module:
        | "dashboard_stats"
        | "conversations"
        | "campaigns"
        | "satisfaction_surveys"
        | "order_status"
        | "whatsapp_connection"
        | "ip_whitelist"
        | "send_delay_config"
        | "api_config"
        | "webhook_config"
        | "change_password"
        | "dashboard"
        | "atendimento"
        | "orders"
        | "config"
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_module: [
        "dashboard_stats",
        "conversations",
        "campaigns",
        "satisfaction_surveys",
        "order_status",
        "whatsapp_connection",
        "ip_whitelist",
        "send_delay_config",
        "api_config",
        "webhook_config",
        "change_password",
        "dashboard",
        "atendimento",
        "orders",
        "config",
      ],
      app_role: ["admin", "user"],
    },
  },
} as const
