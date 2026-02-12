'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CalendarDays, Phone, Mail } from 'lucide-react';

interface BookingWithService {
  id: string;
  professional_id: string;
  service_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  notes: string | null;
  created_at: string;
  services: { name: string; price: number } | null;
}

interface BookingsManagerProps {
  bookings: BookingWithService[];
  currency: string;
}

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '\u20AC', GBP: '\u00A3', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(price).toFixed(0)}`;
}

const statusConfig: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  confirmed: { label: 'Confirmado', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  completed: { label: 'Concluido', variant: 'secondary' },
  no_show: { label: 'Nao compareceu', variant: 'outline' },
};

function BookingCard({
  booking,
  currency,
  onStatusChange,
}: {
  booking: BookingWithService;
  currency: string;
  onStatusChange: (id: string, status: string) => void;
}) {
  const config = statusConfig[booking.status];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">{booking.client_name}</h3>
              <Badge variant={config.variant} className="text-[10px]">
                {config.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {booking.services?.name}
              {booking.services?.price
                ? ` - ${formatPrice(booking.services.price, currency)}`
                : ''}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {booking.booking_date.split('-').reverse().join('/')}{' '}
              {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
            </p>
            {booking.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                {booking.notes}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2">
              {booking.client_phone && (
                <a
                  href={`tel:${booking.client_phone}`}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {booking.client_phone}
                </a>
              )}
              {booking.client_email && (
                <a
                  href={`mailto:${booking.client_email}`}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <Mail className="h-3 w-3" />
                  {booking.client_email}
                </a>
              )}
            </div>
          </div>
          {booking.status === 'confirmed' && (
            <div className="flex flex-col gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(booking.id, 'completed')}
              >
                Concluir
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => onStatusChange(booking.id, 'cancelled')}
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function BookingsManager({ bookings, currency }: BookingsManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState('all');

  async function handleStatusChange(bookingId: string, status: string) {
    await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);
    router.refresh();
  }

  const filtered =
    tab === 'all'
      ? bookings
      : bookings.filter((b) => b.status === tab);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Agendamentos</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmados</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          <TabsTrigger value="completed">Concluidos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Nenhum agendamento encontrado.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filtered.map((booking) => (
                <BookingCard
                  key={booking.id}
                  booking={booking}
                  currency={currency}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
