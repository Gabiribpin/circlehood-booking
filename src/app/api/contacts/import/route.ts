import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get professional_id
    const { data: professional, error: profError } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (profError || !professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    // Parse CSV from FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    // Skip header row
    const dataLines = lines.slice(1);

    const contacts = dataLines.map(line => {
      const [name, email, phone, notes] = line.split(',').map(s => s.trim());
      return {
        professional_id: professional.id,
        name,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        source: 'import' as const,
        marketing_consent: false,
        whatsapp_consent: false,
      };
    }).filter(c => c.name); // Only keep rows with a name

    // Insert contacts
    const { data, error } = await supabase
      .from('contacts')
      .insert(contacts)
      .select();

    if (error) {
      console.error('Error inserting contacts:', error);
      return NextResponse.json({ error: 'Failed to import contacts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      imported: data?.length || 0
    });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
