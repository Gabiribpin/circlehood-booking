-- Marketing: QR Codes and Analytics
-- Sprint 4: QR Code & Marketing Materials

-- Table for saved QR codes
CREATE TABLE qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(200) NOT NULL,
  config JSONB NOT NULL, -- {color, size, logoEnabled}
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for QR scan tracking (analytics)
CREATE TABLE qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,
  qr_code_id UUID REFERENCES qr_codes(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  user_agent TEXT,
  referrer TEXT,
  ip_address INET
);

-- Indexes for performance
CREATE INDEX idx_qr_codes_professional ON qr_codes(professional_id);
CREATE INDEX idx_qr_scans_professional ON qr_scans(professional_id);
CREATE INDEX idx_qr_scans_qr_code ON qr_scans(qr_code_id);
CREATE INDEX idx_qr_scans_date ON qr_scans(scanned_at DESC);

-- Enable RLS
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for qr_codes
CREATE POLICY "Users can view their own QR codes"
ON qr_codes FOR SELECT
TO authenticated
USING (
  professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own QR codes"
ON qr_codes FOR INSERT
TO authenticated
WITH CHECK (
  professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own QR codes"
ON qr_codes FOR UPDATE
TO authenticated
USING (
  professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own QR codes"
ON qr_codes FOR DELETE
TO authenticated
USING (
  professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  )
);

-- RLS Policies for qr_scans
CREATE POLICY "Users can view their own QR scans"
ON qr_scans FOR SELECT
TO authenticated
USING (
  professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Anonymous users can insert scan records"
ON qr_scans FOR INSERT
TO anon
WITH CHECK (true);

-- Storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('qr-codes', 'qr-codes', true, 1048576, ARRAY['image/png', 'image/jpeg', 'image/svg+xml'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users can upload their own QR codes"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'qr-codes' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own QR codes"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'qr-codes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own QR codes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'qr-codes' AND auth.uid() IS NOT NULL);

CREATE POLICY "Public can view all QR codes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'qr-codes');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for qr_codes table
CREATE TRIGGER update_qr_codes_updated_at
BEFORE UPDATE ON qr_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
