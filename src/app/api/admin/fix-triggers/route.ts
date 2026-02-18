import { NextResponse } from 'next/server';

// Rota temporária: aplica fix do trigger via pg directo
// Usa a variável de ambiente DATABASE_URL se disponível, senão usa supabase admin
export async function POST() {
  // Tentar via supabase admin client com rpc exec_sql (não funciona sem a função)
  // Usar fetch directo para o endpoint de management API do Supabase
  const projectRef = 'ibkkxykcrwhncvqxzynt';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const fixSQL = `
CREATE OR REPLACE FUNCTION sync_booking_to_calendar()
RETURNS TRIGGER AS $$
DECLARE
  v_professional_id uuid;
  v_service_name text;
  v_event_title text;
BEGIN
  SELECT b.professional_id, s.name
  INTO v_professional_id, v_service_name
  FROM bookings b
  LEFT JOIN services s ON s.id = b.service_id
  WHERE b.id = NEW.id;

  v_event_title := COALESCE(v_service_name, 'Agendamento') || ' - ' || NEW.client_name;

  INSERT INTO calendar_events (
    professional_id, booking_id, title, description,
    start_time, end_time, location, source, synced_to_google
  )
  VALUES (
    v_professional_id, NEW.id, v_event_title,
    'Cliente: ' || NEW.client_name || E'\\nTelefone: ' || COALESCE(NEW.client_phone, ''),
    (NEW.booking_date::date + NEW.start_time::time)::timestamptz,
    (NEW.booking_date::date + NEW.end_time::time)::timestamptz,
    NULL, 'circlehood', false
  )
  ON CONFLICT (booking_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    synced_to_google = false,
    updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_loyalty_stamp_on_completion()
RETURNS TRIGGER AS $$
DECLARE
  v_loyalty_card RECORD;
  v_new_rewards integer;
BEGIN
  IF OLD.status != 'completed' AND NEW.status = 'completed' THEN
    INSERT INTO loyalty_cards (
      professional_id, contact_id, contact_phone, contact_name, current_stamps, total_stamps
    ) VALUES (
      NEW.professional_id, NEW.contact_id, NEW.client_phone, NEW.client_name, 1, 1
    )
    ON CONFLICT (professional_id, contact_phone) DO UPDATE SET
      current_stamps = loyalty_cards.current_stamps + 1,
      total_stamps = loyalty_cards.total_stamps + 1,
      updated_at = now()
    RETURNING * INTO v_loyalty_card;

    v_new_rewards := (v_loyalty_card.current_stamps / 10)::integer;
    IF v_new_rewards > 0 THEN
      UPDATE loyalty_cards SET
        current_stamps = v_loyalty_card.current_stamps % 10,
        rewards_available = rewards_available + v_new_rewards,
        updated_at = now()
      WHERE id = v_loyalty_card.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
  `.trim();

  // Tentar via Supabase Management API (requer PAT, não service_role)
  // Isto vai falhar com 403, mas vamos tentar
  const mgmtRes = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: fixSQL }),
    }
  );

  if (mgmtRes.ok) {
    return NextResponse.json({ success: true, method: 'management_api' });
  }

  const mgmtError = await mgmtRes.text();

  return NextResponse.json({
    success: false,
    error: `Management API requer PAT (não service_role): ${mgmtRes.status}`,
    fix_sql: fixSQL,
    instructions: [
      '1. Abrir: https://supabase.com/dashboard/project/ibkkxykcrwhncvqxzynt/sql/new',
      '2. Colar o conteúdo de fix_sql acima',
      '3. Clicar Run',
      '4. Voltar e re-executar o script de teste',
    ],
    mgmt_response: mgmtError.substring(0, 200),
  }, { status: 503 });
}
