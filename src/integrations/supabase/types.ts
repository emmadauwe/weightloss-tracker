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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friend_status"]
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friend_status"]
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friend_status"]
        }
        Relationships: []
      }
      high_fives: {
        Row: {
          created_at: string
          from_user: string
          id: string
          kind: string
          seen: boolean
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          kind: string
          seen?: boolean
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          kind?: string
          seen?: boolean
          to_user?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_id: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          share_dishes: boolean
          share_goal: boolean
          share_macros: boolean
          share_progress: boolean
          share_streak: boolean
          share_weight: boolean
          share_workouts: boolean
          updated_at: string
        }
        Insert: {
          avatar_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          share_dishes?: boolean
          share_goal?: boolean
          share_macros?: boolean
          share_progress?: boolean
          share_streak?: boolean
          share_weight?: boolean
          share_workouts?: boolean
          updated_at?: string
        }
        Update: {
          avatar_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          share_dishes?: boolean
          share_goal?: boolean
          share_macros?: boolean
          share_progress?: boolean
          share_streak?: boolean
          share_weight?: boolean
          share_workouts?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      shared_dishes: {
        Row: {
          categories: Json
          created_at: string
          id: string
          items: Json
          local_id: string | null
          name: string
          owner_id: string
          recipe_url: string | null
          servings: number
          steps: Json
          updated_at: string
        }
        Insert: {
          categories?: Json
          created_at?: string
          id?: string
          items?: Json
          local_id?: string | null
          name: string
          owner_id: string
          recipe_url?: string | null
          servings?: number
          steps?: Json
          updated_at?: string
        }
        Update: {
          categories?: Json
          created_at?: string
          id?: string
          items?: Json
          local_id?: string | null
          name?: string
          owner_id?: string
          recipe_url?: string | null
          servings?: number
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_data: {
        Row: {
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      user_stats: {
        Row: {
          change_kg: number | null
          current_weight: number | null
          goal_type: string | null
          goal_weight: number | null
          kcal_target: number | null
          kcal_today: number | null
          progress_percent: number | null
          protein_target: number | null
          protein_today: number | null
          start_weight: number | null
          streak_days: number | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          change_kg?: number | null
          current_weight?: number | null
          goal_type?: string | null
          goal_weight?: number | null
          kcal_target?: number | null
          kcal_today?: number | null
          progress_percent?: number | null
          protein_target?: number | null
          protein_today?: number | null
          start_weight?: number | null
          streak_days?: number | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          change_kg?: number | null
          current_weight?: number | null
          goal_type?: string | null
          goal_weight?: number | null
          kcal_target?: number | null
          kcal_today?: number | null
          progress_percent?: number | null
          protein_target?: number | null
          protein_today?: number | null
          start_weight?: number | null
          streak_days?: number | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          avg_speed: number | null
          created_at: string
          date: string
          distance_km: number | null
          duration_min: number | null
          exercises: Json
          id: string
          intensity: string | null
          max_speed: number | null
          note: string | null
          sport: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_speed?: number | null
          created_at?: string
          date: string
          distance_km?: number | null
          duration_min?: number | null
          exercises?: Json
          id?: string
          intensity?: string | null
          max_speed?: number | null
          note?: string | null
          sport: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_speed?: number | null
          created_at?: string
          date?: string
          distance_km?: number | null
          duration_min?: number | null
          exercises?: Json
          id?: string
          intensity?: string | null
          max_speed?: number | null
          note?: string | null
          sport?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      are_friends: { Args: { _a: string; _b: string }; Returns: boolean }
      find_user_by_email: {
        Args: { _email: string }
        Returns: {
          avatar_id: string
          display_name: string
          id: string
        }[]
      }
    }
    Enums: {
      friend_status: "pending" | "accepted"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      friend_status: ["pending", "accepted"],
    },
  },
} as const
