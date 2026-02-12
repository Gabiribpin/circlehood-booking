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
  is_active: boolean;
  trial_ends_at: string;
  subscription_status: 'trial' | 'active' | 'cancelled' | 'expired';
  stripe_customer_id: string | null;
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

export interface BlockedDate {
  id: string;
  professional_id: string;
  blocked_date: string;
  reason: string | null;
}
