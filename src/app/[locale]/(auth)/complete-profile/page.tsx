'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CheckCircle2, XCircle, HelpCircle } from 'lucide-react';
import { CircleHoodLogoFull } from '@/components/branding/logo';
import { COUNTRY_CODES, CATEGORY_KEYS, CURRENCY_BY_COUNTRY } from '@/lib/auth-constants';

export default function CompleteProfilePage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const locale = useLocale();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('Dublin');
  const [country, setCountry] = useState('IE');
  const [currency, setCurrency] = useState('eur');

  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      // Check if already has professional record
      const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (professional) {
        router.replace('/dashboard');
        return;
      }

      // Pre-fill business name from OAuth metadata
      const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
      if (fullName) {
        setBusinessName(fullName);
        const autoSlug = generateSlug(fullName);
        setSlug(autoSlug);
        checkSlugAvailability(autoSlug);
      }

      setChecking(false);
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  async function checkSlugAvailability(slugToCheck: string) {
    if (!slugToCheck || slugToCheck.length < 3) {
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('professionals')
      .select('id')
      .eq('slug', slugToCheck)
      .maybeSingle();
    setSlugAvailable(!data);
    setCheckingSlug(false);
  }

  function handleBusinessNameChange(name: string) {
    setBusinessName(name);
    const newSlug = generateSlug(name);
    setSlug(newSlug);
    checkSlugAvailability(newSlug);
  }

  function handleSlugChange(value: string) {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(cleaned);
    checkSlugAvailability(cleaned);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!slugAvailable) {
      setError(t('slugUnavailableError'));
      setLoading(false);
      return;
    }

    if (!termsAccepted) {
      setError(t('termsRequired'));
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          slug,
          category: category || null,
          city,
          country,
          currency,
          locale,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.redirect) {
          router.push(data.redirect);
          return;
        }
        setError(data.error || t('errorCreateProfile'));
        setLoading(false);
        return;
      }

      router.push(data.redirect || '/subscribe');
      router.refresh();
    } catch {
      setError(t('connectionError'));
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <CircleHoodLogoFull />
          </div>
          <CardTitle className="text-xl font-bold">{t('completeProfile')}</CardTitle>
          <CardDescription>{t('completeProfileDesc')}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="businessName">{t('businessName')} *</Label>
              <Input
                id="businessName"
                placeholder="Ex: Maria's Nails"
                value={businessName}
                onChange={(e) => handleBusinessNameChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="slug">{t('pageLink')} *</Label>
                <span className="relative group">
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-md shadow-md border opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                    {t('slugTooltip')}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  booking.circlehood-tech.com/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="seu-negócio"
                  required
                  minLength={3}
                />
                {checkingSlug && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {!checkingSlug && slugAvailable === true && (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                )}
                {!checkingSlug && slugAvailable === false && (
                  <XCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
              </div>
              {slugAvailable === false && (
                <p className="text-xs text-destructive">{t('slugTaken')}</p>
              )}
              <p className="text-xs text-muted-foreground">{t('slugHint')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">{t('cityLabel')} *</Label>
              <Input
                id="city"
                placeholder="Ex: Dublin, Lisboa, São Paulo"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t('categoryLabel')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`categories.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">{t('countryLabel')} *</Label>
              <Select
                value={country}
                onValueChange={(val) => {
                  setCountry(val);
                  setCurrency(CURRENCY_BY_COUNTRY[val] ?? 'eur');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectCountry')} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {t(`countries.${code}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-xs text-muted-foreground">
                {t('registerTip')}
              </p>
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                {t.rich('acceptTermsRich', {
                  termsLink: (chunks) => (
                    <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                      {chunks}
                    </Link>
                  ),
                  privacyLink: (chunks) => (
                    <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </label>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('createMyPage')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
