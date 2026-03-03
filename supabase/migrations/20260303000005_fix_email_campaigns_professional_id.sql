-- Fix existing email_campaigns where professional_id = auth.users.id
-- instead of professionals.id
UPDATE email_campaigns ec
SET professional_id = p.id
FROM professionals p
WHERE ec.professional_id = p.user_id
  AND ec.professional_id != p.id;
