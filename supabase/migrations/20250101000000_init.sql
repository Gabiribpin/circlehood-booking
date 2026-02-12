-- CircleHood Booking — Database Schema
-- Run this in Supabase SQL Editor

-- Profissionais (donos das páginas)
CREATE TABLE professionals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  slug VARCHAR(100) UNIQUE NOT NULL,
  business_name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  bio TEXT,
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  instagram VARCHAR(100),
  profile_image_url TEXT,
  cover_image_url TEXT,
  address TEXT,
  city VARCHAR(100) DEFAULT 'Dublin',
  country VARCHAR(50) DEFAULT 'Ireland',
  currency VARCHAR(3) DEFAULT 'EUR',
  timezone VARCHAR(50) DEFAULT 'Europe/Dublin',
  is_active BOOLEAN DEFAULT true,
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  subscription_status VARCHAR(20) DEFAULT 'trial',
  stripe_customer_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Serviços oferecidos
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL DEFAULT 60,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Horários de trabalho
CREATE TABLE working_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true
);

-- Agendamentos
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  client_name VARCHAR(200) NOT NULL,
  client_email VARCHAR(200),
  client_phone VARCHAR(20),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dias bloqueados (férias, feriados)
CREATE TABLE blocked_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason VARCHAR(200)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Professionals
ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active professionals"
  ON professionals FOR SELECT
  USING (is_active = true);

CREATE POLICY "Users can insert own profile"
  ON professionals FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON professionals FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own profile"
  ON professionals FOR DELETE
  USING (user_id = auth.uid());

-- Services
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public views active services"
  ON services FOR SELECT
  USING (is_active = true);

CREATE POLICY "Owner manages services insert"
  ON services FOR INSERT
  WITH CHECK (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner manages services update"
  ON services FOR UPDATE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner manages services delete"
  ON services FOR DELETE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

-- Working Hours
ALTER TABLE working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public views hours"
  ON working_hours FOR SELECT
  USING (true);

CREATE POLICY "Owner manages hours insert"
  ON working_hours FOR INSERT
  WITH CHECK (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner manages hours update"
  ON working_hours FOR UPDATE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner manages hours delete"
  ON working_hours FOR DELETE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

-- Bookings
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views bookings"
  ON bookings FOR SELECT
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can create booking"
  ON bookings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owner manages bookings update"
  ON bookings FOR UPDATE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

-- Blocked Dates
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public views blocked dates"
  ON blocked_dates FOR SELECT
  USING (true);

CREATE POLICY "Owner manages blocked dates insert"
  ON blocked_dates FOR INSERT
  WITH CHECK (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner manages blocked dates update"
  ON blocked_dates FOR UPDATE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner manages blocked dates delete"
  ON blocked_dates FOR DELETE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );
