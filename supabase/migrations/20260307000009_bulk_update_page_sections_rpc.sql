-- Atomic bulk update for page_sections ordering
-- Prevents race conditions when concurrent requests reorder sections

CREATE OR REPLACE FUNCTION bulk_update_page_sections(
  p_professional_id UUID,
  p_updates JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item JSONB;
BEGIN
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
