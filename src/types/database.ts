export interface Professional {
  id: string;
  user_id: string;
  slug: string;
  business_name: string;
  category: string | null;
  bio: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  profile_image_url: string | null;
  cover_image_url: string | null;
  address: string | null;
  city: string;
  country: string;
  currency: string;
  timezone: string;
  locale?: string | null;
  is_active: boolean;
  trial_ends_at: string;
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired';
  stripe_customer_id: string | null;
  require_deposit?: boolean;
  deposit_type?: 'percentage' | 'fixed' | null;
  deposit_value?: number | null;
  stripe_account_id?: string | null;
  stripe_onboarding_completed?: boolean;
  created_at: string;
}

export interface Service {
  id: string;
  professional_id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  lifetime_days?: number | null;
}

export interface WorkingHours {
  id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

export interface Booking {
  id: string;
  professional_id: string;
  service_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  booking_id: string | null;
  professional_id: string;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  payment_method: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface BlockedDate {
  id: string;
  professional_id: string;
  blocked_date: string;
  reason: string | null;
}

export interface BlockedPeriod {
  id: string;
  professional_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
}
