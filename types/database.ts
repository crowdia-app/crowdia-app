/**
 * Database types for Crowdia MVP
 * Generated from Supabase schema
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          profile_image_url: string | null;
          bio: string | null;
          points: number;
          check_ins_count: number;
          email_confirmed_points_awarded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          profile_image_url?: string | null;
          bio?: string | null;
          points?: number;
          check_ins_count?: number;
          email_confirmed_points_awarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          profile_image_url?: string | null;
          bio?: string | null;
          points?: number;
          check_ins_count?: number;
          email_confirmed_points_awarded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      organizers: {
        Row: {
          id: string;
          organization_name: string;
          logo_url: string | null;
          address: string | null;
          is_verified: boolean;
          verified_at: string | null;
          verified_by: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          organization_name: string;
          logo_url?: string | null;
          address?: string | null;
          is_verified?: boolean;
          verified_at?: string | null;
          verified_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_name?: string;
          logo_url?: string | null;
          address?: string | null;
          is_verified?: boolean;
          verified_at?: string | null;
          verified_by?: string | null;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          icon: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          icon?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          icon?: string | null;
          sort_order?: number;
          created_at?: string;
        };
      };
      events: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          description: string;
          cover_image_url: string;
          category_id: string | null;
          location_name: string;
          location_lat: number;
          location_lng: number;
          location_address: string;
          event_start_time: string;
          event_end_time: string;
          external_ticket_url: string | null;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organizer_id: string;
          title: string;
          description: string;
          cover_image_url: string;
          category_id?: string | null;
          location_name: string;
          location_lat: number;
          location_lng: number;
          location_address: string;
          event_start_time: string;
          event_end_time: string;
          external_ticket_url?: string | null;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organizer_id?: string;
          title?: string;
          description?: string;
          cover_image_url?: string;
          category_id?: string | null;
          location_name?: string;
          location_lat?: number;
          location_lng?: number;
          location_address?: string;
          event_start_time?: string;
          event_end_time?: string;
          external_ticket_url?: string | null;
          is_featured?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      event_interests: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          created_at?: string;
        };
      };
      event_check_ins: {
        Row: {
          id: string;
          user_id: string;
          event_id: string;
          check_in_location: unknown; // PostGIS Geography type
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_id: string;
          check_in_location: unknown; // PostGIS Geography type
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_id?: string;
          check_in_location?: unknown; // PostGIS Geography type
          created_at?: string;
        };
      };
      badges: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          icon_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          icon_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          icon_url?: string | null;
          created_at?: string;
        };
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_id: string;
          awarded_by: string | null;
          awarded_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          badge_id: string;
          awarded_by?: string | null;
          awarded_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          badge_id?: string;
          awarded_by?: string | null;
          awarded_at?: string;
        };
      };
      waiting_list: {
        Row: {
          id: string;
          email: string;
          user_type: 'social_explorer' | 'event_creator' | 'ambassador';
          instagram: string | null;
          created_at: string;
          invited_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          user_type: 'social_explorer' | 'event_creator' | 'ambassador';
          instagram?: string | null;
          created_at?: string;
          invited_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          user_type?: 'social_explorer' | 'event_creator' | 'ambassador';
          instagram?: string | null;
          created_at?: string;
          invited_at?: string | null;
        };
      };
    };
    Views: {
      events_with_stats: {
        Row: {
          id: string;
          organizer_id: string;
          title: string;
          description: string;
          cover_image_url: string;
          category_id: string | null;
          location_name: string;
          location_lat: number;
          location_lng: number;
          location_address: string;
          event_start_time: string;
          event_end_time: string;
          external_ticket_url: string | null;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
          interested_count: number;
          check_ins_count: number;
        };
      };
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Helper types for application use
export type User = Database['public']['Tables']['users']['Row'];
export type Organizer = Database['public']['Tables']['organizers']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Event = Database['public']['Tables']['events']['Row'];
export type EventWithStats = Database['public']['Views']['events_with_stats']['Row'];
export type EventInterest = Database['public']['Tables']['event_interests']['Row'];
export type EventCheckIn = Database['public']['Tables']['event_check_ins']['Row'];
export type Badge = Database['public']['Tables']['badges']['Row'];
export type UserBadge = Database['public']['Tables']['user_badges']['Row'];
export type WaitingListEntry = Database['public']['Tables']['waiting_list']['Row'];

// Insert types
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type OrganizerInsert = Database['public']['Tables']['organizers']['Insert'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventInterestInsert = Database['public']['Tables']['event_interests']['Insert'];
export type EventCheckInInsert = Database['public']['Tables']['event_check_ins']['Insert'];

// Update types
export type UserUpdate = Database['public']['Tables']['users']['Update'];
export type OrganizerUpdate = Database['public']['Tables']['organizers']['Update'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];

// Composite types for API responses
export type EventWithOrganizerAndCategory = EventWithStats & {
  organizer: Organizer;
  category: Category | null;
  user_is_interested?: boolean;
  user_has_checked_in?: boolean;
};

export type UserProfile = User & {
  badges: (UserBadge & { badge: Badge })[];
  organizer?: Organizer | null;
};
