-- Issue #208: Drop views that reference non-existent columns
-- email_campaign_performance uses professionals.name and professionals.email (don't exist)
-- instagram_performance uses professionals.name and professionals.instagram_handle (don't exist)
-- Neither view is referenced in application code.

DROP VIEW IF EXISTS email_campaign_performance CASCADE;
DROP VIEW IF EXISTS instagram_performance CASCADE;
