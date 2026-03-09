'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { CalendarDays, Phone, Mail, MessageCircle, MapPin, Home, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency?.toUpperCase()] || currency;
  return `${symbol}${Number(price).toFixed(0)}`;
}

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
  const t = useTranslations('bookings');
  const locale = useLocale();

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    confirmed: { label: t('confirmed'), variant: 'default' },
    cancelled: { label: t('cancelled'), variant: 'destructive' },
    completed: { label: t('completed'), variant: 'secondary' },
    no_show:   { label: t('noShow'),    variant: 'outline' },
  };

  const config = statusConfig[booking.status];
  const dateStr = booking.booking_date.split('-').reverse().join('/');

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
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
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Home className="h-2.5 w-2.5" /> {t('atHome')}
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

            {/* Cancel info */}
            {booking.status === 'cancelled' && (
              <div className="mt-2 pt-2 border-t border-destructive/20">
                <p className="text-xs text-muted-foreground">
                  {t('cancelledPrefix')} {booking.cancelled_by === 'professional' ? t('cancelledByProfessional') : t('cancelledByClient')}
                  {booking.cancelled_at && ` ${t('completedOn').replace('✅ ', '')} ${new Date(booking.cancelled_at).toLocaleDateString(locale)}`}
                </p>
                {booking.cancellation_reason && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('reasonPrefix')} <span className="text-foreground">{booking.cancellation_reason}</span>
                  </p>
                )}
              </div>
            )}

            {/* Completed info */}
            {booking.status === 'completed' && booking.completed_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('completedOn')} {new Date(booking.completed_at).toLocaleDateString(locale)}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 mt-2">
              {booking.client_phone && (
                <>
                  <a
                    href={`https://wa.me/${booking.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                      t('waConfirmMsg', {
                        name: booking.client_name,
                        service: booking.services?.name || '',
                        date: dateStr,
                        time: booking.start_time.slice(0, 5),
                      })
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

          <div className="flex flex-col gap-1 shrink-0">
            {booking.status === 'confirmed' && booking.client_phone && (
              <Button variant="outline" size="sm"
                className="gap-1 bg-green-50 dark:bg-green-900/10 hover:bg-green-100 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900"
                asChild>
                <a href={`https://wa.me/${booking.client_phone.replace(/\D/g, '')}?text=${encodeURIComponent(
                  t('waReminderMsg', {
                    name: booking.client_name,
                    service: booking.services?.name || '',
                    time: booking.start_time.slice(0, 5),
                  })
                )}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3 w-3" /> {t('reminder')}
                </a>
              </Button>
            )}
            {booking.status === 'confirmed' && (
              <>
                <Button variant="outline" size="sm"
                  onClick={() => onStatusChange(booking.id, 'completed')}>
                  {t('conclude')}
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive"
                  onClick={() => onCancelClick(booking)}>
                  <XCircle className="h-3.5 w-3.5 mr-1" /> {t('cancelBooking')}
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
  const t = useTranslations('bookings');
  const tc = useTranslations('common');
  const [tab, setTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);

  const [cancellingBooking, setCancellingBooking] = useState<BookingWithService | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [sendNotification, setSendNotification] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const CANCEL_TEMPLATES = [
    t('cancelTemplate1'),
    t('cancelTemplate2'),
    t('cancelTemplate3'),
    t('cancelTemplate4'),
    t('cancelTemplate5'),
  ];

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
      const { error } = await supabase.from('bookings').update({
        status: 'cancelled',
        cancellation_reason: cancellationReason || null,
        cancelled_by: 'professional',
        cancelled_at: new Date().toISOString(),
      }).eq('id', cancellingBooking.id);

      if (error) throw error;

      if (sendNotification && (cancellingBooking.client_phone || cancellingBooking.client_email)) {
        try {
          const res = await fetch('/api/bookings/cancel-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: cancellingBooking.id, cancellationReason }),
          });

          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            let description = t('cancelledNotified');
            if (data.emailSent && !data.whatsappSent) description = t('cancelledEmailOnly');
            else if (!data.emailSent && data.whatsappSent) description = t('cancelledWhatsAppOnly');
            toast({ title: t('cancelledTitle'), description });
          } else {
            toast({
              title: t('cancelled'),
              description: t('cancelledFailed'),
              variant: 'destructive',
            });
          }
        } catch {
          toast({
            title: t('cancelled'),
            description: t('cancelledFailed'),
            variant: 'destructive',
          });
        }
      } else {
        toast({ title: t('cancelledSuccess') });
      }

      setCancellingBooking(null);
      router.refresh();
    } catch (err: any) {
      toast({ title: t('errorCancel'), description: err.message, variant: 'destructive' });
    } finally {
      setCancelling(false);
    }
  }

  // ─── Filtering & Pagination ───────────────────────────────────────────────

  const filtered = useMemo(() => {
    let result = tab === 'all' ? bookings : bookings.filter((b) => b.status === tab);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.client_name.toLowerCase().includes(q) ||
          b.services?.name.toLowerCase().includes(q) ||
          b.client_phone?.includes(q) ||
          b.client_email?.toLowerCase().includes(q),
      );
    }

    if (dateFilter) {
      result = result.filter((b) => b.booking_date === dateFilter);
    }

    return result;
  }, [bookings, tab, searchQuery, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when filters change
  function handleTabChange(value: string) {
    setTab(value);
    setPage(1);
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    setPage(1);
  }

  function handleDateChange(value: string) {
    setDateFilter(value);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full sm:w-44"
        />
        {dateFilter && (
          <Button variant="ghost" size="sm" onClick={() => handleDateChange('')}>
            {t('clearDate')}
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="w-full grid grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="all">
            {t('tabAll')} ({bookings.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            {t('tabConfirmed')} ({bookings.filter(b => b.status === 'confirmed').length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            {t('tabCancelled')} ({bookings.filter(b => b.status === 'cancelled').length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            {t('tabCompleted')} ({bookings.filter(b => b.status === 'completed').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {paginated.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  {searchQuery || dateFilter ? t('noResults') : t('noBookings')}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {paginated.map((booking) => (
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {t('paginationInfo', {
              from: (safePage - 1) * PAGE_SIZE + 1,
              to: Math.min(safePage * PAGE_SIZE, filtered.length),
              total: filtered.length,
            })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      <Dialog open={!!cancellingBooking} onOpenChange={(open) => { if (!open) setCancellingBooking(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('cancelTitle')}</DialogTitle>
            <DialogDescription>
              {cancellingBooking?.client_name} · {cancellingBooking?.services?.name}
              <br />
              {cancellingBooking?.booking_date.split('-').reverse().join('/')} às {cancellingBooking?.start_time.slice(0, 5)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">{t('quickTemplates')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {CANCEL_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl}
                    onClick={() => setCancellationReason(tmpl)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                      cancellationReason === tmpl
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    {tmpl}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="reason">{t('reasonLabel')}</Label>
              <Textarea
                id="reason"
                rows={3}
                placeholder={t('reasonPlaceholder')}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('beSincere')}</p>
            </div>

            {cancellingBooking?.client_phone && (
              <div
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => setSendNotification((v) => !v)}
              >
                <Checkbox
                  checked={sendNotification}
                  onCheckedChange={(v) => setSendNotification(v as boolean)}
                />
                <Label className="text-sm cursor-pointer select-none">
                  {t('notifyWhatsApp')}
                </Label>
              </div>
            )}

            {sendNotification && cancellingBooking?.client_phone && (
              <div className="bg-muted rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">{t('messagePreview')}</p>
                <p>{t('waCancelMsg1', { name: cancellingBooking.client_name })}</p>
                <p>{t('waCancelMsg2')}</p>
                <p>📅 {cancellingBooking.booking_date.split('-').reverse().join('/')} às {cancellingBooking.start_time.slice(0, 5)}</p>
                <p>✂️ {cancellingBooking.services?.name}</p>
                {cancellationReason && <p>{t('waCancelReason', { reason: cancellationReason })}</p>}
                <p>{t('waCancelMsg3')}</p>
                <p>{t('waCancelMsg4')}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancellingBooking(null)}>
              {tc('back')}
            </Button>
            <Button variant="destructive" onClick={confirmCancellation} disabled={cancelling}>
              {cancelling ? t('cancelling') : t('confirmCancelBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
