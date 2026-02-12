'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Loader2, Trash2 } from 'lucide-react';
import type { WorkingHours, BlockedDate } from '@/types/database';

interface ScheduleManagerProps {
  workingHours: WorkingHours[];
  blockedDates: BlockedDate[];
  professionalId: string;
}

const DAY_NAMES = [
  'Domingo',
  'Segunda',
  'Terca',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sabado',
];

interface DayConfig {
  isAvailable: boolean;
  startTime: string;
  endTime: string;
}

export function ScheduleManager({
  workingHours,
  blockedDates,
  professionalId,
}: ScheduleManagerProps) {
  const router = useRouter();
  const supabase = createClient();

  // Initialize days from existing data
  const initialDays: DayConfig[] = Array.from({ length: 7 }, (_, i) => {
    const existing = workingHours.find((wh) => wh.day_of_week === i);
    return {
      isAvailable: existing?.is_available ?? false,
      startTime: existing?.start_time?.slice(0, 5) ?? '09:00',
      endTime: existing?.end_time?.slice(0, 5) ?? '18:00',
    };
  });

  const [days, setDays] = useState<DayConfig[]>(initialDays);
  const [savingHours, setSavingHours] = useState(false);

  // Blocked dates state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState('');
  const [savingBlock, setSavingBlock] = useState(false);

  function updateDay(index: number, updates: Partial<DayConfig>) {
    setDays((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...updates } : d))
    );
  }

  async function saveWorkingHours() {
    setSavingHours(true);

    // Delete all existing
    await supabase
      .from('working_hours')
      .delete()
      .eq('professional_id', professionalId);

    // Insert all 7 days
    const rows = days.map((d, i) => ({
      professional_id: professionalId,
      day_of_week: i,
      start_time: d.startTime,
      end_time: d.endTime,
      is_available: d.isAvailable,
    }));

    await supabase.from('working_hours').insert(rows);

    setSavingHours(false);
    router.refresh();
  }

  async function addBlockedDate() {
    if (!selectedDate) return;
    setSavingBlock(true);

    const dateStr = selectedDate.toISOString().split('T')[0];

    await supabase.from('blocked_dates').insert({
      professional_id: professionalId,
      blocked_date: dateStr,
      reason: blockReason || null,
    });

    setSelectedDate(undefined);
    setBlockReason('');
    setSavingBlock(false);
    router.refresh();
  }

  async function removeBlockedDate(id: string) {
    await supabase.from('blocked_dates').delete().eq('id', id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Horarios</h1>

      <Tabs defaultValue="hours">
        <TabsList>
          <TabsTrigger value="hours">Horarios</TabsTrigger>
          <TabsTrigger value="blocked">Dias bloqueados</TabsTrigger>
        </TabsList>

        <TabsContent value="hours" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {days.map((day, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3 sm:w-32">
                    <button
                      type="button"
                      onClick={() =>
                        updateDay(i, { isAvailable: !day.isAvailable })
                      }
                      className={`w-10 h-6 rounded-full relative transition-colors ${
                        day.isAvailable ? 'bg-primary' : 'bg-muted'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                          day.isAvailable ? 'left-4.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium">{DAY_NAMES[i]}</span>
                  </div>
                  {day.isAvailable && (
                    <div className="flex items-center gap-2 pl-13 sm:pl-0">
                      <Input
                        type="time"
                        value={day.startTime}
                        onChange={(e) =>
                          updateDay(i, { startTime: e.target.value })
                        }
                        className="w-28 sm:w-32"
                      />
                      <span className="text-muted-foreground text-sm">ate</span>
                      <Input
                        type="time"
                        value={day.endTime}
                        onChange={(e) =>
                          updateDay(i, { endTime: e.target.value })
                        }
                        className="w-28 sm:w-32"
                      />
                    </div>
                  )}
                  {!day.isAvailable && (
                    <span className="text-sm text-muted-foreground pl-13 sm:pl-0">
                      Indisponivel
                    </span>
                  )}
                </div>
              ))}
              <Button
                onClick={saveWorkingHours}
                disabled={savingHours}
                className="w-full sm:w-auto"
              >
                {savingHours && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar horarios
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocked" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={{ before: new Date() }}
                  />
                </div>
                <div className="flex-1 space-y-3">
                  <div className="space-y-2">
                    <Label>Motivo (opcional)</Label>
                    <Input
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Ex: Ferias, feriado..."
                    />
                  </div>
                  <Button
                    onClick={addBlockedDate}
                    disabled={!selectedDate || savingBlock}
                    className="w-full"
                  >
                    {savingBlock && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Bloquear data
                  </Button>
                </div>
              </div>

              {blockedDates.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <h3 className="text-sm font-medium">Datas bloqueadas</h3>
                  {blockedDates.map((bd) => (
                    <div
                      key={bd.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {bd.blocked_date.split('-').reverse().join('/')}
                        </p>
                        {bd.reason && (
                          <p className="text-xs text-muted-foreground">
                            {bd.reason}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeBlockedDate(bd.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
