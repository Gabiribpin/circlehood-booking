import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tests that reschedule uses an atomic RPC transaction instead of
 * separate cancel + insert operations with manual rollback.
 *
 * Bug: If insert fails AND rollback also fails, client loses their booking.
 * Fix: Use Supabase RPC `reschedule_booking` that runs cancel + insert
 * in a single PostgreSQL transaction with automatic rollback.
 */

describe('reschedule atomic transaction (issue #7)', () => {
  const chatbotSource = fs.readFileSync(
    path.resolve('src/lib/ai/chatbot.ts'),
    'utf-8',
  );

  const migrationSource = fs.readFileSync(
    path.resolve(
      'supabase/migrations/20260303000004_reschedule_booking_rpc.sql',
    ),
    'utf-8',
  );

  describe('chatbot.ts uses RPC instead of manual operations', () => {
    it('calls reschedule_booking RPC', () => {
      expect(chatbotSource).toContain(".rpc('reschedule_booking'");
    });

    it('does NOT manually cancel + insert in rescheduleAppointment', () => {
      // Extract only the rescheduleAppointment method body
      const methodStart = chatbotSource.indexOf(
        'private async rescheduleAppointment(',
      );
      const methodEnd = chatbotSource.indexOf(
        'private async cancelAppointment(',
      );
      const methodBody = chatbotSource.slice(methodStart, methodEnd);

      // Should NOT have separate update to cancelled status
      expect(methodBody).not.toContain(
        ".update({\n          status: 'cancelled',",
      );

      // Should NOT have manual rollback to confirmed
      expect(methodBody).not.toContain(
        ".update({ status: 'confirmed', cancelled_by: null",
      );

      // Should NOT have separate insert for new booking
      expect(methodBody).not.toMatch(
        /\.insert\(\{[^}]*professional_id:\s*professionalId/,
      );
    });

    it('handles RPC error responses correctly', () => {
      const methodStart = chatbotSource.indexOf(
        'private async rescheduleAppointment(',
      );
      const methodEnd = chatbotSource.indexOf(
        'private async cancelAppointment(',
      );
      const methodBody = chatbotSource.slice(methodStart, methodEnd);

      // Handles not_found from RPC
      expect(methodBody).toContain("result.error === 'not_found'");

      // Handles not_confirmed from RPC
      expect(methodBody).toContain("result.error === 'not_confirmed'");

      // Handles slot_taken (unique violation) from RPC
      expect(methodBody).toContain("result.error === 'slot_taken'");
    });
  });

  describe('RPC migration ensures atomicity', () => {
    it('creates reschedule_booking function', () => {
      expect(migrationSource).toContain(
        'CREATE OR REPLACE FUNCTION reschedule_booking(',
      );
    });

    it('uses FOR UPDATE lock to prevent race conditions', () => {
      expect(migrationSource).toContain('FOR UPDATE');
    });

    it('validates booking exists and is confirmed', () => {
      expect(migrationSource).toContain('IF NOT FOUND THEN');
      expect(migrationSource).toContain("v_existing.status != 'confirmed'");
    });

    it('cancels old booking within transaction', () => {
      expect(migrationSource).toContain("SET status = 'cancelled'");
    });

    it('inserts new booking within transaction', () => {
      expect(migrationSource).toContain('INSERT INTO bookings');
      expect(migrationSource).toContain('RETURNING id INTO v_new_id');
    });

    it('handles unique_violation (23505) with automatic rollback', () => {
      expect(migrationSource).toContain('WHEN unique_violation THEN');
      expect(migrationSource).toContain("'error', 'slot_taken'");
    });

    it('catches unexpected errors with automatic rollback', () => {
      expect(migrationSource).toContain('WHEN OTHERS THEN');
      expect(migrationSource).toContain("'error', 'unexpected'");
    });

    it('uses SECURITY DEFINER for service-role access', () => {
      expect(migrationSource).toContain('SECURITY DEFINER');
    });

    it('returns success with new_booking_id on happy path', () => {
      expect(migrationSource).toContain("'success', true");
      expect(migrationSource).toContain("'new_booking_id', v_new_id");
    });
  });
});
