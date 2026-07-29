export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      draws: {
        Row: {
          created_at: string;
          draw_date: string;
          draw_number: string;
          ganadores: Json;
          id: string;
          premio_mayor_num: number;
          raffle_id: string;
          seco1_num: number;
          seco2_num: number;
        };
        Insert: {
          created_at?: string;
          draw_date: string;
          draw_number: string;
          ganadores: Json;
          id?: string;
          premio_mayor_num: number;
          raffle_id: string;
          seco1_num: number;
          seco2_num: number;
        };
        Update: {
          created_at?: string;
          draw_date?: string;
          draw_number?: string;
          ganadores?: Json;
          id?: string;
          premio_mayor_num?: number;
          raffle_id?: string;
          seco1_num?: number;
          seco2_num?: number;
        };
        Relationships: [
          {
            foreignKeyName: "draws_raffle_id_fkey";
            columns: ["raffle_id"];
            isOneToOne: false;
            referencedRelation: "raffles";
            referencedColumns: ["id"];
          },
        ];
      };
      raffles: {
        Row: {
          activa: boolean;
          bre_b: string | null;
          created_at: string;
          daviplata: string | null;
          digitos: number;
          fecha_sorteo: string | null;
          id: string;
          loteria: string | null;
          nequi: string | null;
          nombre: string;
          premio_aprox_ant: number;
          premio_aprox_pos: number;
          premio_mayor: number;
          premio_seco1: number;
          premio_seco2: number;
          public_skin: string;
          staged_payments: boolean;
          installment_amount: number | null;
          serie: string | null;
          updated_at: string;
          valor_boleta: number;
          whatsapp_admin: string | null;
        };
        Insert: {
          activa?: boolean;
          bre_b?: string | null;
          created_at?: string;
          daviplata?: string | null;
          digitos?: number;
          fecha_sorteo?: string | null;
          id?: string;
          loteria?: string | null;
          nequi?: string | null;
          nombre: string;
          premio_aprox_ant?: number;
          premio_aprox_pos?: number;
          premio_mayor?: number;
          premio_seco1?: number;
          premio_seco2?: number;
          public_skin?: string;
          staged_payments?: boolean;
          installment_amount?: number | null;
          serie?: string | null;
          updated_at?: string;
          valor_boleta?: number;
          whatsapp_admin?: string | null;
        };
        Update: {
          activa?: boolean;
          bre_b?: string | null;
          created_at?: string;
          daviplata?: string | null;
          digitos?: number;
          fecha_sorteo?: string | null;
          id?: string;
          loteria?: string | null;
          nequi?: string | null;
          nombre?: string;
          premio_aprox_ant?: number;
          premio_aprox_pos?: number;
          premio_mayor?: number;
          premio_seco1?: number;
          premio_seco2?: number;
          public_skin?: string;
          staged_payments?: boolean;
          installment_amount?: number | null;
          serie?: string | null;
          updated_at?: string;
          valor_boleta?: number;
          whatsapp_admin?: string | null;
        };
        Relationships: [];
      };
      tickets: {
        Row: {
          ciudad: string | null;
          codigo_verificacion: string;
          created_at: string;
          email: string | null;
          estado: Database["public"]["Enums"]["ticket_estado"];
          fecha_compra: string | null;
          id: string;
          medio_pago: string | null;
          monto_recibido: number | null;
          nombre: string | null;
          numero: number;
          numero_alterno: number | null;
          observaciones: string | null;
          premio_ganado: string | null;
          raffle_id: string;
          referencia_pago: string | null;
          telefono: string | null;
          total_abonado: number;
          updated_at: string;
          validado_at: string | null;
          validado_por: string | null;
          valor_pagado: number | null;
        };
        Insert: {
          ciudad?: string | null;
          codigo_verificacion?: string;
          created_at?: string;
          email?: string | null;
          estado?: Database["public"]["Enums"]["ticket_estado"];
          fecha_compra?: string | null;
          id?: string;
          medio_pago?: string | null;
          monto_recibido?: number | null;
          nombre?: string | null;
          numero: number;
          numero_alterno?: number | null;
          observaciones?: string | null;
          premio_ganado?: string | null;
          raffle_id: string;
          referencia_pago?: string | null;
          telefono?: string | null;
          total_abonado?: number;
          updated_at?: string;
          validado_at?: string | null;
          validado_por?: string | null;
          valor_pagado?: number | null;
        };
        Update: {
          ciudad?: string | null;
          codigo_verificacion?: string;
          created_at?: string;
          email?: string | null;
          estado?: Database["public"]["Enums"]["ticket_estado"];
          fecha_compra?: string | null;
          id?: string;
          medio_pago?: string | null;
          monto_recibido?: number | null;
          nombre?: string | null;
          numero?: number;
          numero_alterno?: number | null;
          observaciones?: string | null;
          premio_ganado?: string | null;
          raffle_id?: string;
          referencia_pago?: string | null;
          telefono?: string | null;
          total_abonado?: number;
          updated_at?: string;
          validado_at?: string | null;
          validado_por?: string | null;
          valor_pagado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_raffle_id_fkey";
            columns: ["raffle_id"];
            isOneToOne: false;
            referencedRelation: "raffles";
            referencedColumns: ["id"];
          },
        ];
      };
      ticket_payments: {
        Row: {
          amount: number;
          created_at: string;
          id: string;
          notes: string | null;
          paid_at: string;
          payment_method: string | null;
          reference: string;
          ticket_id: string;
          validated_by: string | null;
        };
        Insert: {
          amount: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string;
          payment_method?: string | null;
          reference: string;
          ticket_id: string;
          validated_by?: string | null;
        };
        Update: {
          amount?: number;
          created_at?: string;
          id?: string;
          notes?: string | null;
          paid_at?: string;
          payment_method?: string | null;
          reference?: string;
          ticket_id?: string;
          validated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ticket_payments_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      raffle_draw_stages: {
        Row: {
          completed_at: string | null;
          created_at: string;
          draw_at: string;
          id: string;
          minimum_paid: number;
          name: string;
          prize_amount: number;
          raffle_id: string;
          result_number: number | null;
          updated_at: string;
          winner_ticket_id: string | null;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          draw_at: string;
          id?: string;
          minimum_paid: number;
          name: string;
          prize_amount?: number;
          raffle_id: string;
          result_number?: number | null;
          updated_at?: string;
          winner_ticket_id?: string | null;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          draw_at?: string;
          id?: string;
          minimum_paid?: number;
          name?: string;
          prize_amount?: number;
          raffle_id?: string;
          result_number?: number | null;
          updated_at?: string;
          winner_ticket_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "raffle_draw_stages_raffle_id_fkey";
            columns: ["raffle_id"];
            isOneToOne: false;
            referencedRelation: "raffles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "raffle_draw_stages_winner_ticket_id_fkey";
            columns: ["winner_ticket_id"];
            isOneToOne: false;
            referencedRelation: "tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      sponsor_reminder_settings: {
        Row: {
          raffle_id: string;
          enabled: boolean;
          days_before: number;
          days_after: number;
          default_due_day: number | null;
          message_template: string;
          updated_at: string;
        };
        Insert: {
          raffle_id: string;
          enabled?: boolean;
          days_before?: number;
          days_after?: number;
          default_due_day?: number | null;
          message_template?: string;
          updated_at?: string;
        };
        Update: {
          raffle_id?: string;
          enabled?: boolean;
          days_before?: number;
          days_after?: number;
          default_due_day?: number | null;
          message_template?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sponsor_reminders: {
        Row: {
          id: string;
          raffle_id: string;
          ticket_id: string;
          scheduled_for: string;
          kind: string;
          status: string;
          channel: string;
          message: string;
          sent_at: string | null;
          attempts: number;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          raffle_id: string;
          ticket_id: string;
          scheduled_for: string;
          kind: string;
          status?: string;
          channel?: string;
          message: string;
          sent_at?: string | null;
          attempts?: number;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: string;
          sent_at?: string | null;
          attempts?: number;
          error_message?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sponsorship_plans: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          monthly_amount: number;
          due_day: number;
          starts_on: string;
          ends_on: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          monthly_amount: number;
          due_day?: number;
          starts_on?: string;
          ends_on?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          monthly_amount?: number;
          due_day?: number;
          starts_on?: string;
          ends_on?: string | null;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      sponsors: {
        Row: {
          id: string;
          plan_id: string;
          name: string;
          phone: string;
          city: string | null;
          email: string | null;
          monthly_amount: number;
          next_due_on: string;
          status: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          name: string;
          phone: string;
          city?: string | null;
          email?: string | null;
          monthly_amount: number;
          next_due_on: string;
          status?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          phone?: string;
          city?: string | null;
          email?: string | null;
          monthly_amount?: number;
          next_due_on?: string;
          status?: string;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sponsor_contributions: {
        Row: {
          id: string;
          sponsor_id: string;
          amount: number;
          reference: string | null;
          paid_at: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          sponsor_id: string;
          amount: number;
          reference?: string | null;
          paid_at?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          amount?: number;
          reference?: string | null;
          paid_at?: string;
          notes?: string | null;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_tickets: {
        Row: {
          estado: Database["public"]["Enums"]["ticket_estado"] | null;
          id: string | null;
          numero: number | null;
          premio_ganado: string | null;
          raffle_id: string | null;
        };
        Insert: {
          estado?: Database["public"]["Enums"]["ticket_estado"] | null;
          id?: string | null;
          numero?: number | null;
          premio_ganado?: string | null;
          raffle_id?: string | null;
        };
        Update: {
          estado?: Database["public"]["Enums"]["ticket_estado"] | null;
          id?: string | null;
          numero?: number | null;
          premio_ganado?: string | null;
          raffle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "tickets_raffle_id_fkey";
            columns: ["raffle_id"];
            isOneToOne: false;
            referencedRelation: "raffles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      bootstrap_first_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      backfill_alternate_numbers: {
        Args: { _raffle_id: string };
        Returns: number;
      };
      get_public_tickets: {
        Args: { _raffle_id: string };
        Returns: {
          raffle_id: string;
          numero: number;
          estado: Database["public"]["Enums"]["ticket_estado"];
          premio_ganado: string | null;
        }[];
      };
      get_public_raffle_stages: {
        Args: { _raffle_id: string };
        Returns: {
          completed_at: string | null;
          draw_at: string;
          id: string;
          minimum_paid: number;
          name: string;
          prize_amount: number;
          result_number: number | null;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin_setup_pending: { Args: Record<PropertyKey, never>; Returns: boolean };
      register_draw: {
        Args: {
          _draw_date: string;
          _draw_number: string;
          _mayor: number;
          _raffle_id: string;
          _seco1: number;
          _seco2: number;
        };
        Returns: Json;
      };
      add_ticket_payment: {
        Args: {
          _amount: number;
          _notes: string | null;
          _reference: string;
          _ticket_id: string;
        };
        Returns: {
          ticket_status: Database["public"]["Enums"]["ticket_estado"];
          total_paid: number;
        }[];
      };
      register_stage_draw: {
        Args: { _result: number; _stage_id: string };
        Returns: Json;
      };
      queue_sponsor_reminders: {
        Args: { _raffle_id: string; _due_at?: string | null };
        Returns: number;
      };
      reserve_ticket: {
        Args: {
          _raffle_id: string;
          _numero: number;
          _nombre: string;
          _telefono: string;
          _ciudad: string;
          _email: string;
          _medio_pago: string;
        };
        Returns: { codigo_verificacion: string; numero: number; numero_alterno: number | null }[];
      };
      set_active_raffle: { Args: { _raffle_id: string; _active: boolean }; Returns: undefined };
    };
    Enums: {
      app_role: "admin";
      ticket_estado: "disponible" | "reservado" | "vendido" | "ganador";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin"],
      ticket_estado: ["disponible", "reservado", "vendido", "ganador"],
    },
  },
} as const;
