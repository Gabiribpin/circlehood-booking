-- Fix existing instagram integrations where professional_id = auth.users.id
-- instead of professionals.id
UPDATE integrations i
SET professional_id = p.id
FROM professionals p
WHERE i.type = 'instagram'
  AND i.professional_id = p.user_id
  AND i.professional_id != p.id;
