-- Fix #458: Add SET search_path to all security-definer functions
-- + Add ownership check to bulk_update_page_sections

-- ============================================================
-- 1. initialize_default_sections — add search_path
-- ============================================================
CREATE OR REPLACE FUNCTION initialize_default_sections(p_professional_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id, 'hero', 1, true,
    '{"ctaText": "Agendar Agora", "showSocialLinks": false}'::jsonb
  ) ON CONFLICT (professional_id, section_type) DO NOTHING;

  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id, 'about', 2, false,
    '{"heading": "Sobre Mim", "description": "", "yearsExperience": 0}'::jsonb
  ) ON CONFLICT (professional_id, section_type) DO NOTHING;

  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id, 'services', 3, true,
    '{"heading": "Meus Serviços", "displayMode": "grid", "showPrices": true, "ctaText": "Agendar"}'::jsonb
  ) ON CONFLICT (professional_id, section_type) DO NOTHING;

  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id, 'gallery', 4, false,
    '{"heading": "Galeria de Trabalhos", "layout": "grid", "columns": 3, "showCategories": true}'::jsonb
  ) ON CONFLICT (professional_id, section_type) DO NOTHING;

  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id, 'testimonials', 5, false,
    '{"heading": "O que dizem meus clientes", "displayMode": "grid", "showRatings": true, "maxToShow": 6}'::jsonb
  ) ON CONFLICT (professional_id, section_type) DO NOTHING;

  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id, 'faq', 6, false,
    '{"heading": "Perguntas Frequentes", "items": []}'::jsonb
  ) ON CONFLICT (professional_id, section_type) DO NOTHING;

  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id, 'contact', 7, true,
    '{"heading": "Entre em Contato", "showPhone": true, "showWhatsApp": true, "showEmail": false}'::jsonb
  ) ON CONFLICT (professional_id, section_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 2. reschedule_booking — add search_path
-- ============================================================
CREATE OR REPLACE FUNCTION reschedule_booking(
  p_booking_id UUID,
  p_professional_id UUID,
  p_new_date DATE,
  p_new_start_time TIME,
  p_new_end_time TIME
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_new_id UUID;
BEGIN
  SELECT id, booking_date, start_time, service_id, client_name, client_phone,
         client_email, notes, service_location, customer_address, status
    INTO v_existing
    FROM bookings
   WHERE id = p_booking_id
     AND professional_id = p_professional_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF v_existing.status != 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_confirmed', 'current_status', v_existing.status);
  END IF;

  UPDATE bookings
     SET status = 'cancelled',
         cancelled_by = 'client',
         cancelled_at = NOW(),
         cancellation_reason = 'Reagendado pelo cliente via WhatsApp'
   WHERE id = p_booking_id;

  INSERT INTO bookings (
    professional_id, service_id, booking_date, start_time, end_time,
    client_name, client_phone, client_email, notes,
    service_location, customer_address, status
  ) VALUES (
    p_professional_id, v_existing.service_id, p_new_date, p_new_start_time, p_new_end_time,
    v_existing.client_name, v_existing.client_phone, v_existing.client_email, v_existing.notes,
    COALESCE(v_existing.service_location, 'in_salon'), v_existing.customer_address, 'confirmed'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_booking_id', v_new_id,
    'old_date', v_existing.booking_date,
    'old_time', v_existing.start_time
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'error', 'slot_taken');
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', 'unexpected', 'detail', SQLERRM);
END;
$$;

COMMENT ON FUNCTION reschedule_booking IS
  'Transactional reschedule: cancels old booking and creates new one atomically. If any step fails, everything rolls back.';

-- ============================================================
-- 3. bulk_update_page_sections — add search_path + ownership check
-- ============================================================
CREATE OR REPLACE FUNCTION bulk_update_page_sections(
  p_professional_id UUID,
  p_updates JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
BEGIN
  -- Ownership check: caller must own this professional
  IF NOT EXISTS (
    SELECT 1 FROM professionals
    WHERE id = p_professional_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    UPDATE page_sections
    SET
      order_index = (item->>'order_index')::int,
      is_visible = (item->>'is_visible')::boolean,
      updated_at = now()
    WHERE id = (item->>'id')::uuid
      AND professional_id = p_professional_id;
  END LOOP;
END;
$$;

-- ============================================================
-- 4. cleanup_expired_verification_tokens — add search_path
-- ============================================================
CREATE OR REPLACE FUNCTION cleanup_expired_verification_tokens()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM email_verification_tokens
  WHERE expires_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_verification_tokens() IS
  'Deletes expired (>7 days old) email verification tokens. Call periodically via cron.';
