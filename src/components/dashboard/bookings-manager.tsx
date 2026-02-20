'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarDays, Phone, Mail, MessageCircle, MapPin, Home, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  service_location?: string | null;
  customer_address?: string | null;
  customer_address_city?: string | null;
  cancellation_reason?: string | null;
  cancelled_by?: string | null;
  cancelled_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  services: { name: string; price: number } | null;
}

interface BookingsManagerProps {
  bookings: BookingWithService[];
  currency: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(price).toFixed(0)}`;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  confirmed: { label: 'Confirmado',       variant: 'default' },
  cancelled: { label: 'Cancelado',        variant: 'destructive' },
  completed: { label: 'Concluído',        variant: 'secondary' },
  no_show:   { label: 'Não compareceu',   variant: 'outline' },
};

const CANCEL_TEMPLATES = [
  'Tive uma emergência familiar',
  'Estou com um problema de saúde',
  'Houve um imprevisto no trabalho',
  'Condições climáticas desfavoráveis',
  'Preciso remarcar por motivos pessoais',
];

// ─── BookingCard ──────────────────────────────────────────────────────────────

function BookingCard({
  booking,
  currency,
  onStatusChange,
  onCancelClick,
}: {
  booking: BookingWithService;
  currency: string;
  onStatusChange: (id: string, status: string) => void;
  onCancelClick: (booking: BookingWithService) => void;
}) {
  const config = statusConfig[booking.status];
  const dateStr = booking.booking_date.split('-').reverse().join('/');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium">{booking.client_name}</h3>
              <Badge variant={config.variant} className="text-[10px]">{config.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {booking.services?.name}
              {booking.services?.price ? ` - ${formatPrice(booking.services.price, currency)}` : ''}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {dateStr} {booking.start_time.slice(0, 5)} - {booking.end_time.slice(0, 5)}
            </p>

            {booking.service_location === 'at_home' && (
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Home className="h-2.5 w-2.5" /> A domicílio
                </Badge>
                {booking.customer_address && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {booking.customer_address}
                    {booking.customer_address_city ? `, ${booking.customer_address_city}` : ''}
                  </span>
                )}
              </div>
            )}

            {booking.notes && (
              <p className="text-xs text-muted-foreground mt-1 italic">{booking.notes}</p>
            )}

            {/* Info de cancelamento */}
            {booking.status === 'cancelled' && (
              <div className="mt-2 pt-2 border-t border-destructive/20">
                <p className="text-xs text-muted-foreground">
                  Cancelado {booking.cancelled_by === 'professional' ? 'por você' : 'pelo cliente'}
                  {booking.cancelled_at && ` em ${new Date(booking.cancelled_at).toLocaleDateString('pt-BR')}`}
                </p>
                {booking.cancellation_reason && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Motivo: <span className="text-foreground">{booking.cancellation_reason}</span>
                  </p>
                )}
              </div>
            )}

            {/* Info de conclusão */}
            {booking.status === 'completed' && booking.completed_at && (
              <p className="text-xs text-muted-foreground mt-1">
                ✅ Concluído em {new Date(booking.completed_at).toLocaleDateString('pt-BR')}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2">
              {booking.client_phone && (
                <>
                  <a
                    href={`https://wa.me/${booking.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                      `Olá ${booking.client_name}! Confirmando seu agendamento: ${booking.services?.name} em ${dateStr} às ${booking.start_time.slice(0, 5)}. Até lá!`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded-md flex items-center gap-1 hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
                  >
                    <MessageCircle className="h-3 w-3" /> WhatsApp
                  </a>
                  <a href={`tel:${booking.client_phone}`}
                    className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                    <Phone className="h-3 w-3" /> {booking.client_phone}
                  </a>
                </>
              )}
              {booking.client_email && (
                <a href={`mailto:${booking.client_email}`}
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                  <Mail className="h-3 w-3" /> {booking.client_email}
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            {booking.status === 'confirmed' && booking.client_phone && (
              <Button variant="outline" size="sm"
                className="gap-1 bg-green-50 dark:bg-green-900/10 hover:bg-green-100 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900"
                asChild>
                <a href={`https://wa.me/${booking.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Olá ${booking.client_name}! Lembrando que você tem um agendamento amanhã: ${booking.services?.name} às ${booking.start_time.slice(0, 5)}. Te espero!`
                )}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3 w-3" /> Lembrete
                </a>
              </Button>
            )}
            {booking.status === 'confirmed' && (
              <>
                <Button variant="outline" size="sm"
                  onClick={() => onStatusChange(booking.id, 'completed')}>
                  Concluir
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive"
                  onClick={() => onCancelClick(booking)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── BookingsManager ──────────────────────────────────────────────────────────

export function BookingsManager({ bookings, currency }: BookingsManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const [tab, setTab] = useState('all');

  // Estado do modal de cancelamento
  const [cancellingBooking, setCancellingBooking] = useState<BookingWithService | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  async function handleStatusChange(bookingId: string, status: string) {
    const updateData: Record<string, any> = { status };
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    await supabase.from('bookings').update(updateData).eq('id', bookingId);
    router.refresh();
  }

  function handleCancelClick(booking: BookingWithService) {
    setCancellingBooking(booking);
    setCancellationReason('');
    setSendNotification(true);
  }

  async function confirmCancellation() {
    if (!cancellingBooking) return;
    setCancelling(true);

    try {
      // 1. Cancelar no banco
      const { error } = await supabase.from('bookings').update({
        status: 'cancelled',
        cancellation_reason: cancellationReason || null,
        cancelled_by: 'professional',
        cancelled_at: new Date().toISOString(),
      }).eq('id', cancellingBooking.id);

      if (error) throw error;

      // 2. Enviar notificação (se marcado e tem telefone)
      if (sendNotification && cancellingBooking.client_phone) {
        try {
          const res = await fetch('/api/bookings/cancel-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: cancellingBooking.id, cancellationReason }),
          });

          if (res.ok) {
            toast({ title: 'Cancelado!', description: 'Cliente notificado via WhatsApp.' });
          } else {
            toast({
              title: 'Cancelado',
              description: 'Agendamento cancelado, mas não foi possível enviar o WhatsApp.',
              variant: 'destructive',
            });
          }
        } catch {
          toast({
            title: 'Cancelado',
            description: 'Agendamento cancelado, mas não foi possível enviar o WhatsApp.',
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: 'Agendamento cancelado.' });
      }

      setCancellingBooking(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: 'Erro ao cancelar', description: err.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  }

  const filtered = tab === 'all' ? bookings : bookings.filter((b) => b.status === tab);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Agendamentos</h1>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmados</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
          <TabsTrigger value="completed">Concluídos</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum agendamento encontrado.</p>
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
                  onCancelClick={handleCancelClick}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de cancelamento */}
      <Dialog open={!!cancellingBooking} onOpenChange={(open) => { if (!open) setCancellingBooking(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancelar Agendamento</DialogTitle>
            <DialogDescription>
              {cancellingBooking?.client_name} · {cancellingBooking?.services?.name}
              <br />
              {cancellingBooking?.booking_date.split('-').reverse().join('/')} às {cancellingBooking?.start_time.slice(0, 5)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Templates rápidos */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Templates rápidos</Label>
              <div className="flex flex-wrap gap-1.5">
                {CANCEL_TEMPLATES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setCancellationReason(t)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                      cancellationReason === t
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-1.5">
              <Label htmlFor="reason">Motivo (será enviado ao cliente)</Label>
              <Textarea
                id="reason"
                rows={3}
                placeholder="Escreva o motivo ou escolha um template acima..."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Seja sincero e educado.</p>
            </div>

            {/* Notificação */}
            {cancellingBooking?.client_phone && (
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setSendNotification((v) => !v)}
              >
                <Checkbox
                  checked={sendNotification}
                  onCheckedChange={(v) => setSendNotification(v)}
                />
                <Label className="text-sm cursor-pointer select-none">
                  Notificar cliente via WhatsApp
                </Label>
              </div>
            )}

            {/* Preview da mensagem */}
            {sendNotification && cancellingBooking?.client_phone && (
              <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Prévia da mensagem:</p>
                <p>Olá {cancellingBooking.client_name}! 😔</p>
                <p>Infelizmente precisamos cancelar seu agendamento:</p>
                <p>📅 {cancellingBooking.booking_date.split('-').reverse().join('/')} às {cancellingBooking.start_time.slice(0, 5)}</p>
                <p>✂️ {cancellingBooking.services?.name}</p>
                {cancellationReason && <p>Motivo: {cancellationReason}</p>}
                <p>Pedimos desculpas pelo transtorno! 🙏</p>
                <p>Gostaria de remarcar? Estou à disposição! 😊</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancellingBooking(null)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={confirmCancellation} disabled={cancelling}>
              {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
