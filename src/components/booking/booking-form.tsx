'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/ui/phone-input';
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
        <PhoneInput
          value={data.clientPhone}
          onChange={(value) => update('clientPhone', value || '')}
          placeholder={t('phonePlaceholder')}
          defaultCountry="IE"
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
