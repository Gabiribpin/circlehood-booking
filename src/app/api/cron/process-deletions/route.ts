import { logger } from '@/lib/logger';
import { verifyCronSecret } from '@/lib/cron-auth';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let processed = 0;

  try {
    // Find professionals whose deletion date has passed
    const { data: toDelete, error: fetchError } = await supabase
      .from('professionals')
      .select('id, user_id, business_name, slug')
      .not('deleted_at', 'is', null)
      .lte('deletion_scheduled_for', new Date().toISOString());

    if (fetchError) throw fetchError;
    if (!toDelete || toDelete.length === 0) {
      await supabase.from('cron_logs').insert({
        job_name: 'process-deletions',
        status: 'success',
        records_processed: 0,
        execution_time_ms: Date.now() - startTime,
        metadata: { message: 'No accounts pending deletion' },
      });
      return NextResponse.json({ success: true, processed: 0 });
    }

    for (const professional of toDelete) {
      try {
        const pid = professional.id;

        // 1. Anonymise bookings (retain for audit, remove PII)
        await supabase
          .from('bookings')
          .update({
            client_name: '[Removido]',
            client_email: null,
            client_phone: null,
            notes: null,
          })
          .eq('professional_id', pid);

        // 2. Delete all professional data
        const tablesToDelete = [
          'services',
          'working_hours',
          'blocked_dates',
          'blocked_periods',
          'contacts',
          'whatsapp_config',
          'whatsapp_conversations',
          'page_sections',
          'testimonials',
          'ai_instructions',
          'whatsapp_templates',
          'notification_logs',
          'gallery_images',
          'email_campaigns',
        ] as const;

        for (const table of tablesToDelete) {
          await supabase.from(table).delete().eq('professional_id', pid);
        }

        // 3. Delete the professional record
        await supabase.from('professionals').delete().eq('id', pid);

        // 4. Delete the auth user
        await supabase.auth.admin.deleteUser(professional.user_id);

        logger.info(
          `[account-deletion] Professional ${professional.slug} (id=${pid}) permanently deleted at ${new Date().toISOString()}`
        );

        processed++;
      } catch (indivError: any) {
        logger.error(
          `[account-deletion] Failed to delete professional ${professional.id}:`,
          indivError
        );
      }
    }

    await supabase.from('cron_logs').insert({
      job_name: 'process-deletions',
      status: 'success',
      records_processed: processed,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        accounts_deleted: processed,
        professional_ids: toDelete.map((p) => p.id),
      },
    } as never);

    return NextResponse.json({ success: true, processed });
  } catch (error: any) {
    logger.error('[process-deletions] Error:', error);

    await supabase.from('cron_logs').insert({
      job_name: 'process-deletions',
      status: 'error',
      error_message: error.message,
      execution_time_ms: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
