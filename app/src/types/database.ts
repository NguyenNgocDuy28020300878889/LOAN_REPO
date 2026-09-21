/**
 * Minimal database contract used by the mobile client.
 *
 * Keep this aligned with `supabase/migrations`. The app only invokes RPCs;
 * financial tables intentionally remain inaccessible from the client.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: {
      register_push_device: {
        Args: {
          device_id_input: string;
          secret_input: string;
          token_input: string;
          platform_input: string;
          timezone_input: string;
          locale_input: string;
        };
        Returns: undefined;
      };
      unregister_push_device: {
        Args: { device_id_input: string; secret_input: string };
        Returns: undefined;
      };
      accept_loan_invite: {
        Args: { idempotency_key_input: string; invite_token_input: string };
        Returns: Json;
      };
      create_loan: {
        Args: {
          creator_role_input: 'LENDER' | 'BORROWER';
          currency_input: string;
          due_date_input: string;
          idempotency_key_input: string;
          loan_date_input: string;
          note_input: string | null;
          principal_minor_input: number;
          purpose_input: string | null;
        };
        Returns: Json;
      };
      decline_loan_invite: {
        Args: { idempotency_key_input: string; invite_token_input: string };
        Returns: Json;
      };
      manage_loan_invite: {
        Args: {
          loan_id_input: string;
          action_input: 'rotate' | 'revoke';
          idempotency_key_input: string;
        };
        Returns: Json;
      };
      get_loan_invite_preview: {
        Args: { invite_token_input: string };
        Returns: Json;
      };
      get_loan_room: {
        Args: { loan_id_input: string };
        Returns: Json;
      };
      get_loan_repayments: { Args: { loan_id_input: string }; Returns: Json };
      get_my_loans: { Args: Record<PropertyKey, never>; Returns: Json };
      submit_repayment: {
        Args: {
          amount_minor_input: number;
          idempotency_key_input: string;
          loan_id_input: string;
          method_input: string | null;
          note_input: string | null;
          payment_date_input: string;
        };
        Returns: Json;
      };
      confirm_repayment: {
        Args: { idempotency_key_input: string; repayment_id_input: string };
        Returns: Json;
      };
      dispute_repayment: {
        Args: { idempotency_key_input: string; repayment_id_input: string };
        Returns: Json;
      };
      cancel_repayment: {
        Args: { idempotency_key_input: string; repayment_id_input: string };
        Returns: Json;
      };
      get_my_notification_preferences: { Args: Record<PropertyKey, never>; Returns: Json };
      update_my_notification_preferences: {
        Args: { due_reminders_enabled_input: boolean; push_enabled_input: boolean };
        Returns: Json;
      };
      ensure_my_profile: {
        Args: { display_name_input: string | null; locale_input: string | null };
        Returns: Json;
      };
      request_account_deletion: { Args: Record<PropertyKey, never>; Returns: Json };
    };
    Enums: { loan_role: 'LENDER' | 'BORROWER' };
    CompositeTypes: Record<string, never>;
  };
};
