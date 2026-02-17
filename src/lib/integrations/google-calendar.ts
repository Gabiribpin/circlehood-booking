import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@/lib/supabase/server';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

/**
 * Cria cliente OAuth2 do Google
 */
export function getOAuth2Client(): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );

  return oauth2Client;
}

/**
 * Gera URL de autorização OAuth
 */
export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Força refresh token na primeira vez
  });

  return authUrl;
}

/**
 * Troca code por tokens (access_token + refresh_token)
 */
export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  return tokens;
}

/**
 * Busca credentials salvos do banco e retorna cliente autenticado
 */
export async function getAuthenticatedClient(professionalId: string): Promise<OAuth2Client | null> {
  const supabase = await createClient();

  // Buscar credenciais do profissional
  const { data: integration } = await supabase
    .from('integrations')
    .select('credentials')
    .eq('professional_id', professionalId)
    .eq('integration_type', 'google_calendar')
    .eq('is_configured', true)
    .single();

  if (!integration?.credentials) {
    return null;
  }

  // Decriptar credenciais (TODO: implementar encriptação)
  const credentials = integration.credentials as any;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
  });

  // Refresh token automaticamente se expirado
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.refresh_token) {
      // Atualizar no banco
      await supabase
        .from('integrations')
        .update({
          credentials: {
            ...credentials,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token || credentials.refresh_token,
            expiry_date: tokens.expiry_date,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('professional_id', professionalId)
        .eq('integration_type', 'google_calendar');
    }
  });

  return oauth2Client;
}

/**
 * Cria evento no Google Calendar
 */
export async function createGoogleCalendarEvent(
  professionalId: string,
  event: {
    summary: string;
    description?: string;
    start: string; // ISO 8601
    end: string;
    location?: string;
  }
) {
  const auth = await getAuthenticatedClient(professionalId);
  if (!auth) {
    throw new Error('Google Calendar not connected');
  }

  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: {
        dateTime: event.start,
        timeZone: 'Europe/Dublin',
      },
      end: {
        dateTime: event.end,
        timeZone: 'Europe/Dublin',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 60 },
          { method: 'popup', minutes: 1440 }, // 24h antes
        ],
      },
    },
  });

  return response.data;
}

/**
 * Atualiza evento no Google Calendar
 */
export async function updateGoogleCalendarEvent(
  professionalId: string,
  eventId: string,
  updates: {
    summary?: string;
    description?: string;
    start?: string;
    end?: string;
    location?: string;
    status?: 'confirmed' | 'tentative' | 'cancelled';
  }
) {
  const auth = await getAuthenticatedClient(professionalId);
  if (!auth) {
    throw new Error('Google Calendar not connected');
  }

  const calendar = google.calendar({ version: 'v3', auth });

  const requestBody: any = {};

  if (updates.summary) requestBody.summary = updates.summary;
  if (updates.description) requestBody.description = updates.description;
  if (updates.location) requestBody.location = updates.location;
  if (updates.status) requestBody.status = updates.status;

  if (updates.start && updates.end) {
    requestBody.start = {
      dateTime: updates.start,
      timeZone: 'Europe/Dublin',
    };
    requestBody.end = {
      dateTime: updates.end,
      timeZone: 'Europe/Dublin',
    };
  }

  const response = await calendar.events.patch({
    calendarId: 'primary',
    eventId: eventId,
    requestBody,
  });

  return response.data;
}

/**
 * Deleta evento do Google Calendar
 */
export async function deleteGoogleCalendarEvent(
  professionalId: string,
  eventId: string
) {
  const auth = await getAuthenticatedClient(professionalId);
  if (!auth) {
    throw new Error('Google Calendar not connected');
  }

  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
}

/**
 * Lista eventos do Google Calendar (próximos 30 dias)
 */
export async function listGoogleCalendarEvents(
  professionalId: string,
  startDate?: Date,
  endDate?: Date
) {
  const auth = await getAuthenticatedClient(professionalId);
  if (!auth) {
    throw new Error('Google Calendar not connected');
  }

  const calendar = google.calendar({ version: 'v3', auth });

  const timeMin = startDate || new Date();
  const timeMax = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 100,
  });

  return response.data.items || [];
}

/**
 * Sincroniza eventos do Google para o CircleHood
 */
export async function syncGoogleEventsToCircleHood(professionalId: string) {
  const supabase = await createClient();

  // Buscar eventos do Google
  const googleEvents = await listGoogleCalendarEvents(professionalId);

  const results = {
    imported: 0,
    updated: 0,
    errors: 0,
  };

  for (const event of googleEvents) {
    try {
      if (!event.id || !event.start?.dateTime || !event.end?.dateTime) {
        continue;
      }

      // Inserir ou atualizar no calendar_events
      const { error } = await supabase
        .from('calendar_events')
        .upsert(
          {
            professional_id: professionalId,
            google_event_id: event.id,
            google_calendar_id: event.organizer?.email || 'primary',
            title: event.summary || 'Sem título',
            description: event.description || null,
            start_time: event.start.dateTime,
            end_time: event.end.dateTime,
            location: event.location || null,
            status: event.status || 'confirmed',
            source: 'google',
            synced_to_google: true,
            last_synced_at: new Date().toISOString(),
          },
          {
            onConflict: 'google_event_id',
          }
        );

      if (error) {
        console.error('Error syncing event:', error);
        results.errors++;
      } else {
        results.imported++;
      }
    } catch (error) {
      console.error('Error processing event:', error);
      results.errors++;
    }
  }

  // Atualizar last_sync_at na integração
  await supabase
    .from('integrations')
    .update({
      last_sync_at: new Date().toISOString(),
      last_error: results.errors > 0 ? `${results.errors} events failed` : null,
      error_count: results.errors,
    })
    .eq('professional_id', professionalId)
    .eq('integration_type', 'google_calendar');

  return results;
}

/**
 * Sincroniza bookings do CircleHood para o Google Calendar
 */
export async function syncCircleHoodEventsToGoogle(professionalId: string) {
  const supabase = await createClient();

  // Buscar eventos não sincronizados
  const { data: events } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('source', 'circlehood')
    .eq('synced_to_google', false)
    .limit(50);

  if (!events || events.length === 0) {
    return { synced: 0, errors: 0 };
  }

  const results = {
    synced: 0,
    errors: 0,
  };

  for (const event of events) {
    try {
      const googleEvent = await createGoogleCalendarEvent(professionalId, {
        summary: event.title,
        description: event.description || undefined,
        start: event.start_time,
        end: event.end_time,
        location: event.location || undefined,
      });

      // Atualizar calendar_event com google_event_id
      await supabase
        .from('calendar_events')
        .update({
          google_event_id: googleEvent.id,
          synced_to_google: true,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', event.id);

      results.synced++;
    } catch (error) {
      console.error('Error syncing to Google:', error);
      results.errors++;
    }
  }

  return results;
}

/**
 * Sincronização bidirecional completa
 */
export async function fullSync(professionalId: string) {
  // 1. Sincronizar do Google para CircleHood
  const googleToCirclehood = await syncGoogleEventsToCircleHood(professionalId);

  // 2. Sincronizar do CircleHood para Google
  const circlehoodToGoogle = await syncCircleHoodEventsToGoogle(professionalId);

  return {
    googleToCirclehood,
    circlehoodToGoogle,
    timestamp: new Date().toISOString(),
  };
}
