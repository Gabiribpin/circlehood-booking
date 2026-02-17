'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, CheckCircle2, XCircle, Calendar as CalendarIcon } from 'lucide-react';

export default function ReschedulePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    try {
      const res = await fetch(`/api/reschedule/${token}`);
      const data = await res.json();

      if (data.valid) {
        setValid(true);
        setBooking(data.booking);
      } else {
        setValid(false);
        setMessage({ type: 'error', text: data.error || 'Token inválido' });
      }
    } catch (error) {
      setValid(false);
      setMessage({ type: 'error', text: 'Erro ao validar token' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setMessage({ type: 'error', text: 'Por favor, informe o motivo do cancelamento' });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/reschedule/${token}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Agendamento cancelado com sucesso!' });
        setTimeout(() => router.push('/'), 3000);
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao cancelar' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao cancelar agendamento' });
    } finally {
      setProcessing(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) {
      setMessage({ type: 'error', text: 'Selecione data e horário' });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/reschedule/${token}/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_date: selectedDate.toISOString().split('T')[0],
          new_time: selectedTime,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: 'success', text: 'Agendamento reagendado com sucesso!' });
        setBooking(data.booking);
        setMode('view');
      } else {
        setMessage({ type: 'error', text: data.error || 'Erro ao reagendar' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Erro ao reagendar' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Link Inválido</h1>
          <p className="text-gray-600">{message?.text}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="p-8">
          <h1 className="text-3xl font-bold mb-6 text-center">
            {mode === 'view' && 'Seu Agendamento'}
            {mode === 'reschedule' && 'Reagendar'}
            {mode === 'cancel' && 'Cancelar Agendamento'}
          </h1>

          {message && (
            <div
              className={`p-4 rounded-lg mb-6 ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          {mode === 'view' && (
            <>
              <div className="bg-purple-50 rounded-lg p-6 mb-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-sm text-gray-600">Serviço:</span>
                    <p className="font-semibold">{booking.services?.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Data:</span>
                    <p className="font-semibold">
                      {new Date(booking.booking_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Horário:</span>
                    <p className="font-semibold">{booking.booking_time.substring(0, 5)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Local:</span>
                    <p className="font-semibold">
                      {booking.professionals?.address || booking.professionals?.city}
                    </p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-600">Valor:</span>
                    <p className="font-semibold">€{booking.services?.price}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => setMode('reschedule')}
                  className="flex-1"
                  variant="outline"
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Reagendar
                </Button>
                <Button
                  onClick={() => setMode('cancel')}
                  variant="destructive"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </>
          )}

          {mode === 'reschedule' && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Selecione a nova data:</label>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date()}
                  className="rounded-md border"
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Selecione o horário:</label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full border rounded-lg p-2"
                >
                  <option value="">Selecione...</option>
                  <option value="09:00">09:00</option>
                  <option value="09:30">09:30</option>
                  <option value="10:00">10:00</option>
                  <option value="10:30">10:30</option>
                  <option value="11:00">11:00</option>
                  <option value="11:30">11:30</option>
                  <option value="14:00">14:00</option>
                  <option value="14:30">14:30</option>
                  <option value="15:00">15:00</option>
                  <option value="15:30">15:30</option>
                  <option value="16:00">16:00</option>
                  <option value="16:30">16:30</option>
                  <option value="17:00">17:00</option>
                </select>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setMode('view')} variant="outline" className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={handleReschedule}
                  disabled={processing}
                  className="flex-1"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Reagendando...
                    </>
                  ) : (
                    'Confirmar'
                  )}
                </Button>
              </div>
            </>
          )}

          {mode === 'cancel' && (
            <>
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">
                  Motivo do cancelamento (opcional):
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full border rounded-lg p-3"
                  rows={4}
                  placeholder="Ex: Imprevistos, mudança de agenda..."
                />
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setMode('view')} variant="outline" className="flex-1">
                  Voltar
                </Button>
                <Button
                  onClick={handleCancel}
                  disabled={processing}
                  variant="destructive"
                  className="flex-1"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    'Confirmar Cancelamento'
                  )}
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
