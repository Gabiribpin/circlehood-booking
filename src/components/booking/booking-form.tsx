'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('public');

  function update(field: keyof BookingFormData, value: string) {
    onChange({ ...data, [field]: value });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="clientName">{t('nameLabel')}</Label>
        <Input
          id="clientName"
          value={data.clientName}
          onChange={(e) => update('clientName', e.target.value)}
          placeholder={t('namePlaceholder')}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clientEmail">{t('emailLabel')}</Label>
        <Input
          id="clientEmail"
          type="email"
          value={data.clientEmail}
          onChange={(e) => update('clientEmail', e.target.value)}
          placeholder="seu@email.com"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="clientPhone">{t('phoneLabel')}</Label>
        <Input
          id="clientPhone"
          type="tel"
          value={data.clientPhone}
          onChange={(e) => update('clientPhone', e.target.value)}
          placeholder={t('phonePlaceholder')}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t('phoneHelp')}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">{t('notesLabel')}</Label>
        <Textarea
          id="notes"
          value={data.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder={t('notesPlaceholder')}
          rows={3}
        />
      </div>
    </div>
  );
}
