'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface TimeSlotsProps {
  professionalId: string;
  serviceId: string;
  date: string; // YYYY-MM-DD
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
}

export function TimeSlots({
  professionalId,
  serviceId,
  date,
  selectedSlot,
  onSelect,
}: TimeSlotsProps) {
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(
      `/api/available-slots?professional_id=${professionalId}&service_id=${serviceId}&date=${date}`
    )
      .then((res) => res.json())
      .then((data) => {
        setSlots(data.slots || []);
        setLoading(false);
      })
      .catch(() => {
        setSlots([]);
        setLoading(false);
      });
  }, [professionalId, serviceId, date]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        Nenhum horario disponível nesta data.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {slots.map((slot) => (
        <Button
          key={slot}
          variant={selectedSlot === slot ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(slot)}
        >
          {slot}
        </Button>
      ))}
    </div>
  );
}
