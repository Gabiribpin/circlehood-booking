'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface BookingFormData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes: string;
}

interface BookingFormProps {
  data: BookingFormData;
  onChange: (data: BookingFormData) => void;
}

export function BookingForm({ data, onChange }: BookingFormProps) {
  function update(field: keyof BookingFormData, value: string) {
    onChange({ ...data, [field]: value });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="clientName">Nome *</Label>
        <Input
          id="clientName"
          value={data.clientName}
          onChange={(e) => update('clientName', e.target.value)}
          placeholder="Seu nome completo"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clientEmail">Email</Label>
        <Input
          id="clientEmail"
          type="email"
          value={data.clientEmail}
          onChange={(e) => update('clientEmail', e.target.value)}
          placeholder="seu@email.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clientPhone">WhatsApp *</Label>
        <Input
          id="clientPhone"
          type="tel"
          value={data.clientPhone}
          onChange={(e) => update('clientPhone', e.target.value)}
          placeholder="+351 912 345 678"
          required
        />
        <p className="text-xs text-muted-foreground">
          Necessário para confirmar seu agendamento
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Observacoes</Label>
        <Textarea
          id="notes"
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Alguma informacao adicional?"
          rows={3}
        />
      </div>
    </div>
  );
}
