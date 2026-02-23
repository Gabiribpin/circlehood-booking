'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/navigation';
import { useTransition } from 'react';

const LANGUAGES = [
  { code: 'pt-BR', name: 'Português', flag: '🇧🇷' },
  { code: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'es-ES', name: 'Español', flag: '🇪🇸' },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('nav');

  function handleChange(newLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
    });
  }

  return (
    <select
      value={locale}
      onChange={(e) => handleChange(e.target.value)}
      disabled={isPending}
      aria-label={t('language')}
      className="text-xs border rounded px-2 py-1 bg-background text-foreground disabled:opacity-50 cursor-pointer"
    >
      {LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}
