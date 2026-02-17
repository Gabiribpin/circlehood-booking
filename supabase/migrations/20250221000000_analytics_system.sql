-- ============================================
-- SPRINT 5: Analytics & Relatórios
-- Migration completa para sistema de analytics
-- ============================================

-- ============================================
-- 1. MATERIALIZED VIEW: Métricas Diárias
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_metrics AS
SELECT
  b.professional_id,
  b.booking_date,

  -- Contadores
  COUNT(*) as total_bookings,
  COUNT(DISTINCT b.client_phone) as unique_clients,
  COUNT(*) FILTER (WHERE b.status = 'confirmed') as confirmed_bookings,
  COUNT(*) FILTER (WHERE b.status = 'cancelled') as cancelled_bookings,

  -- Receita (apenas confirmados)
  COALESCE(SUM(s.price) FILTER (WHERE b.status = 'confirmed'), 0) as total_revenue,
  COALESCE(AVG(s.price) FILTER (WHERE b.status = 'confirmed'), 0) as avg_ticket,

  -- Horários
  MIN(b.start_time) as first_booking_time,
  MAX(b.start_time) as last_booking_time,

  -- Source tracking
  COUNT(*) FILTER (WHERE b.notes ILIKE '%qr%') as from_qr_scan,

  -- Metadata
  NOW() as computed_at

FROM bookings b
INNER JOIN services s ON b.service_id = s.id
WHERE b.created_at >= CURRENT_DATE - INTERVAL '2 years'
GROUP BY b.professional_id, b.booking_date;

-- Índices para performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_metrics_unique
ON daily_metrics(professional_id, booking_date);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_date
ON daily_metrics(booking_date DESC);

-- ============================================
-- 2. VIEW: Classificação de Clientes
-- ============================================

CREATE OR REPLACE VIEW client_classification AS
WITH client_bookings AS (
  SELECT
    b.professional_id,
    b.client_phone,
    b.client_name,
    MIN(b.booking_date) as first_booking_date,
    MAX(b.booking_date) as last_booking_date,
    COUNT(*) FILTER (WHERE b.status = 'confirmed') as total_bookings,
    COALESCE(SUM(s.price) FILTER (WHERE b.status = 'confirmed'), 0) as total_spent,

    -- Calcular dias desde último agendamento
    CURRENT_DATE - MAX(b.booking_date) as days_since_last_booking

  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  GROUP BY b.professional_id, b.client_phone, b.client_name
)
SELECT
  professional_id,
  client_phone,
  client_name,
  first_booking_date,
  last_booking_date,
  total_bookings,
  total_spent,
  days_since_last_booking,

  -- Classificação de tipo
  CASE
    WHEN total_bookings = 1 THEN 'new'
    WHEN total_bookings <= 3 THEN 'occasional'
    WHEN total_bookings > 3 THEN 'recurring'
    ELSE 'unknown'
  END as client_type,

  -- Status de engajamento
  CASE
    WHEN days_since_last_booking <= 30 THEN 'active'
    WHEN days_since_last_booking <= 90 THEN 'at_risk'
    WHEN days_since_last_booking > 90 THEN 'churned'
    ELSE 'unknown'
  END as engagement_status,

  -- Calcular LTV (Lifetime Value)
  total_spent as lifetime_value,

  -- Ticket médio
  CASE
    WHEN total_bookings > 0 THEN total_spent / total_bookings
    ELSE 0
  END as avg_ticket

FROM client_bookings;

-- ============================================
-- 3. TABELA: Cache de Analytics
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- Identificação da métrica
  metric_key TEXT NOT NULL,
  period_start DATE,
  period_end DATE,

  -- Dados em JSON
  data JSONB NOT NULL,

  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  -- Constraint única
  UNIQUE(professional_id, metric_key, period_start, period_end)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_analytics_cache_lookup
ON analytics_cache(professional_id, metric_key, expires_at);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_expires
ON analytics_cache(expires_at)
WHERE expires_at > NOW();

-- ============================================
-- 4. FUNÇÃO: Limpar Cache Expirado
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM analytics_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. FUNÇÃO: Refresh Materialized View
-- ============================================

CREATE OR REPLACE FUNCTION refresh_daily_metrics()
RETURNS TEXT AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_metrics;
  RETURN 'Daily metrics refreshed at ' || NOW()::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. FUNÇÃO: Série Temporal de Receita
-- ============================================

CREATE OR REPLACE FUNCTION get_revenue_timeseries(
  p_professional_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_granularity TEXT DEFAULT 'day'
)
RETURNS TABLE (
  period TEXT,
  total_revenue NUMERIC,
  total_bookings BIGINT,
  unique_clients BIGINT,
  avg_ticket NUMERIC,
  cancelled_rate NUMERIC
) AS $$
BEGIN
  IF p_granularity = 'day' THEN
    RETURN QUERY
    SELECT
      dm.booking_date::TEXT as period,
      COALESCE(dm.total_revenue, 0) as total_revenue,
      dm.total_bookings,
      dm.unique_clients,
      COALESCE(dm.avg_ticket, 0) as avg_ticket,
      CASE
        WHEN dm.total_bookings > 0
        THEN (dm.cancelled_bookings::NUMERIC / dm.total_bookings * 100)
        ELSE 0
      END as cancelled_rate
    FROM daily_metrics dm
    WHERE dm.professional_id = p_professional_id
      AND dm.booking_date BETWEEN p_start_date AND p_end_date
    ORDER BY dm.booking_date;

  ELSIF p_granularity = 'week' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(DATE_TRUNC('week', dm.booking_date), 'YYYY-"W"IW') as period,
      SUM(dm.total_revenue) as total_revenue,
      SUM(dm.total_bookings) as total_bookings,
      SUM(dm.unique_clients) as unique_clients,
      AVG(dm.avg_ticket) as avg_ticket,
      AVG(CASE
        WHEN dm.total_bookings > 0
        THEN (dm.cancelled_bookings::NUMERIC / dm.total_bookings * 100)
        ELSE 0
      END) as cancelled_rate
    FROM daily_metrics dm
    WHERE dm.professional_id = p_professional_id
      AND dm.booking_date BETWEEN p_start_date AND p_end_date
    GROUP BY DATE_TRUNC('week', dm.booking_date)
    ORDER BY DATE_TRUNC('week', dm.booking_date);

  ELSIF p_granularity = 'month' THEN
    RETURN QUERY
    SELECT
      TO_CHAR(dm.booking_date, 'YYYY-MM') as period,
      SUM(dm.total_revenue) as total_revenue,
      SUM(dm.total_bookings) as total_bookings,
      SUM(dm.unique_clients) as unique_clients,
      AVG(dm.avg_ticket) as avg_ticket,
      AVG(CASE
        WHEN dm.total_bookings > 0
        THEN (dm.cancelled_bookings::NUMERIC / dm.total_bookings * 100)
        ELSE 0
      END) as cancelled_rate
    FROM daily_metrics dm
    WHERE dm.professional_id = p_professional_id
      AND dm.booking_date BETWEEN p_start_date AND p_end_date
    GROUP BY TO_CHAR(dm.booking_date, 'YYYY-MM')
    ORDER BY TO_CHAR(dm.booking_date, 'YYYY-MM');
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 7. FUNÇÃO: Ranking de Serviços
-- ============================================

CREATE OR REPLACE FUNCTION get_services_ranking(
  p_professional_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  service_price NUMERIC,
  total_bookings BIGINT,
  total_revenue NUMERIC,
  avg_bookings_per_day NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as service_id,
    s.name as service_name,
    s.price as service_price,
    COUNT(b.id) as total_bookings,
    SUM(s.price) as total_revenue,
    COUNT(b.id)::NUMERIC / GREATEST(EXTRACT(DAYS FROM (p_end_date - p_start_date))::NUMERIC, 1) as avg_bookings_per_day
  FROM services s
  LEFT JOIN bookings b ON b.service_id = s.id
    AND b.booking_date BETWEEN p_start_date AND p_end_date
    AND b.status = 'confirmed'
    AND b.professional_id = p_professional_id
  WHERE s.professional_id = p_professional_id
    AND s.is_active = true
  GROUP BY s.id, s.name, s.price
  HAVING COUNT(b.id) > 0
  ORDER BY total_revenue DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 8. FUNÇÃO: Horários de Pico
-- ============================================

CREATE OR REPLACE FUNCTION get_peak_hours(
  p_professional_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  hour_of_day INTEGER,
  day_of_week INTEGER,
  total_bookings BIGINT,
  avg_revenue NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    EXTRACT(HOUR FROM b.start_time::TIME)::INTEGER as hour_of_day,
    EXTRACT(DOW FROM b.booking_date)::INTEGER as day_of_week,
    COUNT(*) as total_bookings,
    AVG(s.price) as avg_revenue
  FROM bookings b
  INNER JOIN services s ON b.service_id = s.id
  WHERE b.professional_id = p_professional_id
    AND b.booking_date BETWEEN p_start_date AND p_end_date
    AND b.status = 'confirmed'
  GROUP BY
    EXTRACT(HOUR FROM b.start_time::TIME),
    EXTRACT(DOW FROM b.booking_date)
  ORDER BY total_bookings DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- 9. RLS Policies
-- ============================================

ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Professionals can manage their own cache" ON analytics_cache;
CREATE POLICY "Professionals can manage their own cache"
ON analytics_cache FOR ALL
TO authenticated
USING (
  professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  )
);

-- ============================================
-- 10. Índices de Performance Adicionais
-- ============================================

-- Otimizar queries de bookings por período
CREATE INDEX IF NOT EXISTS idx_bookings_analytics_period
ON bookings(professional_id, booking_date, status)
INCLUDE (service_id, client_phone, start_time, client_name)
WHERE status = 'confirmed';

-- Otimizar queries de receita
CREATE INDEX IF NOT EXISTS idx_bookings_revenue_calc
ON bookings(professional_id, booking_date, service_id)
WHERE status = 'confirmed';

-- Otimizar queries de horários
CREATE INDEX IF NOT EXISTS idx_bookings_time_analysis
ON bookings(professional_id, start_time::TIME, booking_date)
WHERE status = 'confirmed';

-- ============================================
-- 11. Trigger: Auto-cleanup de cache
-- ============================================

-- Não vamos criar trigger de auto-cleanup para não sobrecarregar
-- Usar CRON job externo para chamar cleanup_expired_cache()

-- ============================================
-- FINALIZAÇÃO
-- ============================================

-- Popular materialized view inicial
REFRESH MATERIALIZED VIEW daily_metrics;

-- Comentários nas tabelas
COMMENT ON MATERIALIZED VIEW daily_metrics IS 'Métricas diárias agregadas para performance de queries analytics';
COMMENT ON VIEW client_classification IS 'Classificação de clientes por tipo e engajamento';
COMMENT ON TABLE analytics_cache IS 'Cache de queries pesadas de analytics com TTL';

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Sprint 5 Analytics migration completed successfully!';
  RAISE NOTICE 'Created: daily_metrics, client_classification, analytics_cache';
  RAISE NOTICE 'Created functions: get_revenue_timeseries, get_services_ranking, get_peak_hours';
END $$;
