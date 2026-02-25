import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(_request: NextRequest) {
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch professional profile (exclude internal fields)
    const { data: professional } = await supabase
      .from('professionals')
      .select(
        'id, business_name, slug, email, phone, whatsapp, instagram, bio, address, address_city, address_country, category, currency, locale, subscription_status, created_at, onboarding_completed_at'
      )
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    const pid = professional.id;

    // Fetch all related data in parallel
    const [
      services,
      bookings,
      contacts,
      workingHours,
      blockedDates,
      blockedPeriods,
      pageSections,
      testimonials,
    ] = await Promise.all([
      supabase.from('services').select('*').eq('professional_id', pid),
      supabase.from('bookings').select('*').eq('professional_id', pid).order('booking_date', { ascending: false }),
      supabase.from('contacts').select('*').eq('professional_id', pid),
      supabase.from('working_hours').select('*').eq('professional_id', pid),
      supabase.from('blocked_dates').select('*').eq('professional_id', pid),
      supabase.from('blocked_periods').select('*').eq('professional_id', pid),
      supabase.from('page_sections').select('*').eq('professional_id', pid),
      supabase.from('testimonials').select('*').eq('professional_id', pid),
    ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      gdpr_article: 'Art. 20 GDPR — Right to Data Portability',
      professional: professional,
      services: services.data ?? [],
      bookings: bookings.data ?? [],
      contacts: contacts.data ?? [],
      schedule: {
        working_hours: workingHours.data ?? [],
        blocked_dates: blockedDates.data ?? [],
        blocked_periods: blockedPeriods.data ?? [],
      },
      page: {
        sections: pageSections.data ?? [],
      },
      testimonials: testimonials.data ?? [],
    };

    const json = JSON.stringify(exportData, null, 2);
    const date = new Date().toISOString().split('T')[0];
    const filename = `circlehood-data-export-${date}.json`;

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('[export-data] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
