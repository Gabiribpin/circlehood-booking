-- Atualizar todos os profissionais com 'Ireland' para 'IE'
UPDATE professionals
SET address_country = 'IE'
WHERE address_country = 'Ireland';

-- Atualizar outros países comuns se existirem
UPDATE professionals
SET address_country = 'BR'
WHERE address_country IN ('Brazil', 'Brasil');

UPDATE professionals
SET address_country = 'US'
WHERE address_country IN ('United States', 'USA', 'America');

UPDATE professionals
SET address_country = 'GB'
WHERE address_country IN ('United Kingdom', 'England', 'UK');

UPDATE professionals
SET address_country = 'ES'
WHERE address_country IN ('Spain', 'España', 'Espanha');

UPDATE professionals
SET address_country = 'PT'
WHERE address_country = 'Portugal';

-- Verificar resultados
SELECT address_country, COUNT(*) as total
FROM professionals
GROUP BY address_country;
