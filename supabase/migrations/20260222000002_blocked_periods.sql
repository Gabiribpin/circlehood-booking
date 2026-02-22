-- Tabela para períodos bloqueados (férias, feriados longos, recesso)
-- Diferente de blocked_dates (dia único), aqui suportamos ranges completos.

CREATE TABLE IF NOT EXISTS blocked_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES professionals(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT blocked_periods_valid_range CHECK (start_date <= end_date)
);

-- Index para queries rápidas do tipo: date BETWEEN start_date AND end_date
CREATE INDEX IF NOT EXISTS idx_blocked_periods_lookup
  ON blocked_periods (professional_id, start_date, end_date);

COMMENT ON TABLE blocked_periods IS 'Períodos bloqueados para agendamento (férias, recesso, feriados prolongados)';
COMMENT ON COLUMN blocked_periods.reason IS 'Motivo do bloqueio: Férias, Feriado, Recesso, etc';

-- RLS
ALTER TABLE blocked_periods ENABLE ROW LEVEL SECURITY;

-- Clientes podem ver períodos bloqueados (para saber que não há horários)
CREATE POLICY "Public views blocked periods"
  ON blocked_periods FOR SELECT
  USING (true);

CREATE POLICY "Owner manages blocked periods insert"
  ON blocked_periods FOR INSERT
  WITH CHECK (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner manages blocked periods update"
  ON blocked_periods FOR UPDATE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );

CREATE POLICY "Owner manages blocked periods delete"
  ON blocked_periods FOR DELETE
  USING (
    professional_id IN (SELECT id FROM professionals WHERE user_id = auth.uid())
  );
