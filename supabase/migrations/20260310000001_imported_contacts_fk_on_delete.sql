-- Fix imported_contacts.preferred_service_id FK to SET NULL on service deletion
-- Prevents orphaned rows when a service is deleted (#475)

ALTER TABLE imported_contacts
  DROP CONSTRAINT IF EXISTS imported_contacts_preferred_service_id_fkey;

ALTER TABLE imported_contacts
  ADD CONSTRAINT imported_contacts_preferred_service_id_fkey
    FOREIGN KEY (preferred_service_id) REFERENCES services(id) ON DELETE SET NULL;
