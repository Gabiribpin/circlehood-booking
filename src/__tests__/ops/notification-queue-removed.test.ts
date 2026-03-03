import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

/**
 * Tests that notification_queue (dead queue) has been fully removed.
 *
 * Bug: notification_queue received inserts via triggers and route handlers,
 * but was never processed (no cron in vercel.json). Records accumulated
 * indefinitely, creating confusion and risk of duplicate notifications
 * if someone accidentally added a cron.
 *
 * Fix: Remove all inserts into notification_queue, drop trigger that used it,
 * and drop the table itself.
 */

describe('notification_queue removal (issue #18)', () => {
  // Files that previously inserted into notification_queue
  const changeRoute = readFileSync(
    resolve('src/app/api/reschedule/[token]/change/route.ts'),
    'utf-8',
  );

  const cancelRoute = readFileSync(
    resolve('src/app/api/reschedule/[token]/cancel/route.ts'),
    'utf-8',
  );

  const automationsPage = readFileSync(
    resolve('src/app/[locale]/(dashboard)/automations/page.tsx'),
    'utf-8',
  );

  const migration = readFileSync(
    resolve(
      'supabase/migrations/20260303000007_drop_notification_queue.sql',
    ),
    'utf-8',
  );

  describe('app code no longer references notification_queue', () => {
    it('reschedule change route does not insert into notification_queue', () => {
      expect(changeRoute).not.toContain('notification_queue');
    });

    it('reschedule cancel route does not insert into notification_queue', () => {
      expect(cancelRoute).not.toContain('notification_queue');
    });

    it('automations page does not query notification_queue', () => {
      expect(automationsPage).not.toContain('notification_queue');
    });
  });

  describe('cleanup migration drops dead queue', () => {
    it('drops the booking_notify_waitlist trigger', () => {
      expect(migration).toContain(
        'DROP TRIGGER IF EXISTS booking_notify_waitlist ON bookings',
      );
    });

    it('recreates notify_waitlist_on_cancellation WITHOUT notification_queue insert', () => {
      // The function body after CREATE OR REPLACE should NOT contain notification_queue
      const funcStart = migration.indexOf(
        'CREATE OR REPLACE FUNCTION notify_waitlist_on_cancellation()',
      );
      const funcEnd = migration.indexOf('$$ LANGUAGE plpgsql;');
      const funcBody = migration.slice(funcStart, funcEnd);
      expect(funcBody).not.toContain('notification_queue');
    });

    it('preserves waitlist notification logic (marks as notified)', () => {
      expect(migration).toContain('UPDATE waitlist');
      expect(migration).toContain("notified = true");
      expect(migration).toContain("status = 'notified'");
    });

    it('drops notification_queue table', () => {
      expect(migration).toContain(
        'DROP TABLE IF EXISTS notification_queue CASCADE',
      );
    });

    it('recreates the trigger with updated function', () => {
      expect(migration).toContain(
        'CREATE TRIGGER booking_notify_waitlist',
      );
      expect(migration).toContain(
        'EXECUTE FUNCTION notify_waitlist_on_cancellation()',
      );
    });
  });

  describe('vercel.json has no notification_queue cron', () => {
    const vercelConfig = readFileSync(resolve('vercel.json'), 'utf-8');

    it('does not reference notification_queue or notifications/send cron', () => {
      expect(vercelConfig).not.toContain('notification_queue');
      expect(vercelConfig).not.toContain('notifications/send');
    });
  });
});
