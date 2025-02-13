export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      bridge_transactions: {
        Row: {
          amount: string;
          completed_at: string | null;
          created_at: string | null;
          destination_block_number: number | null;
          destination_tx_hash: string | null;
          external_call_state: string | null;
          fix_fee: number | null;
          id: string;
          metadata: Json | null;
          order_id: string | null;
          percent_fee: number | null;
          source_block_number: number | null;
          source_tx_hash: string | null;
          state: string | null;
          status: string;
          token_in_address: string | null;
          token_in_chain_id: number | null;
          token_in_decimals: number | null;
          token_in_symbol: string | null;
          token_out_address: string | null;
          token_out_chain_id: number | null;
          token_out_decimals: number | null;
          token_out_symbol: string | null;
          unlock_block_number: number | null;
          unlock_tx_hash: string | null;
          user_id: string;
        };
        Insert: {
          amount: string;
          completed_at?: string | null;
          created_at?: string | null;
          destination_block_number?: number | null;
          destination_tx_hash?: string | null;
          external_call_state?: string | null;
          fix_fee?: number | null;
          id?: string;
          metadata?: Json | null;
          order_id?: string | null;
          percent_fee?: number | null;
          source_block_number?: number | null;
          source_tx_hash?: string | null;
          state?: string | null;
          status: string;
          token_in_address?: string | null;
          token_in_chain_id?: number | null;
          token_in_decimals?: number | null;
          token_in_symbol?: string | null;
          token_out_address?: string | null;
          token_out_chain_id?: number | null;
          token_out_decimals?: number | null;
          token_out_symbol?: string | null;
          unlock_block_number?: number | null;
          unlock_tx_hash?: string | null;
          user_id: string;
        };
        Update: {
          amount?: string;
          completed_at?: string | null;
          created_at?: string | null;
          destination_block_number?: number | null;
          destination_tx_hash?: string | null;
          external_call_state?: string | null;
          fix_fee?: number | null;
          id?: string;
          metadata?: Json | null;
          order_id?: string | null;
          percent_fee?: number | null;
          source_block_number?: number | null;
          source_tx_hash?: string | null;
          state?: string | null;
          status?: string;
          token_in_address?: string | null;
          token_in_chain_id?: number | null;
          token_in_decimals?: number | null;
          token_in_symbol?: string | null;
          token_out_address?: string | null;
          token_out_chain_id?: number | null;
          token_out_decimals?: number | null;
          token_out_symbol?: string | null;
          unlock_block_number?: number | null;
          unlock_tx_hash?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bridge_transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      chat_messages: {
        Row: {
          content: string;
          created_at: string | null;
          id: string;
          role: string;
          tool_invocations: Json | null;
          user_id: string;
        };
        Insert: {
          content: string;
          created_at?: string | null;
          id: string;
          role: string;
          tool_invocations?: Json | null;
          user_id: string;
        };
        Update: {
          content?: string;
          created_at?: string | null;
          id?: string;
          role?: string;
          tool_invocations?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      limit_orders: {
        Row: {
          amount_in: number;
          created_at: string | null;
          executed_at: string | null;
          execution_tx_hash: string | null;
          id: string;
          metadata: Json | null;
          status: string;
          target_price: number;
          token_in: string;
          token_out: string;
          user_id: string;
        };
        Insert: {
          amount_in: number;
          created_at?: string | null;
          executed_at?: string | null;
          execution_tx_hash?: string | null;
          id?: string;
          metadata?: Json | null;
          status: string;
          target_price: number;
          token_in: string;
          token_out: string;
          user_id: string;
        };
        Update: {
          amount_in?: number;
          created_at?: string | null;
          executed_at?: string | null;
          execution_tx_hash?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          target_price?: number;
          token_in?: string;
          token_out?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'limit_orders_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_swaps: {
        Row: {
          amount_in: number;
          amount_out: number;
          completed_at: string | null;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          status: string;
          token_in: string;
          token_out: string;
          tx_hash: string | null;
          user_id: string;
        };
        Insert: {
          amount_in: number;
          amount_out: number;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          status: string;
          token_in: string;
          token_out: string;
          tx_hash?: string | null;
          user_id: string;
        };
        Update: {
          amount_in?: number;
          amount_out?: number;
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          status?: string;
          token_in?: string;
          token_out?: string;
          tx_hash?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_swaps_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string | null;
          id: string;
          last_active_at: string | null;
          wallet_address: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          last_active_at?: string | null;
          wallet_address: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          last_active_at?: string | null;
          wallet_address?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views']) | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes'] | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
    ? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;
