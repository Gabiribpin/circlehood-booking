'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { CircleHoodLogoFull } from '@/components/branding/logo';

const COUNTRIES: { code: string; label: string }[] = [
  { code: 'IE', label: 'Irlanda' },
  { code: 'PT', label: 'Portugal' },
  { code: 'BR', label: 'Brasil' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'ES', label: 'Espanha' },
  { code: 'FR', label: 'França' },
  { code: 'DE', label: 'Alemanha' },
  { code: 'IT', label: 'Itália' },
  { code: 'AU', label: 'Austrália' },
  { code: 'CA', label: 'Canadá' },
  { code: 'MX', label: 'México' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colômbia' },
];

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  IE: 'eur', PT: 'eur', ES: 'eur', FR: 'eur', DE: 'eur', IT: 'eur',
  BR: 'brl', GB: 'gbp', US: 'usd', AU: 'aud', CA: 'cad', MX: 'mxn',
  AR: 'ars', CO: 'cop',
};

const CATEGORIES = [
  'Barbeiro',
  'Cabeleireiro(a)',
  'Coach / Consultor',
  'Cleaner',
  'Dog Groomer / Pet',
  'Esteticista',
  'Fisioterapeuta',
  'Fotógrafo',
  'Instrutor de Yoga/Pilates',
  'Makeup Artist',
  'Massagista',
  'Nail Tech',
  'Nutricionista',
  'Personal Trainer',
  'Professor / Tutor',
  'Psicólogo / Terapeuta',
  'Outro',
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (professional) {
        router.replace('/dashboard');
      }
    };
    checkSession();
  }, [router]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Step 1: Account
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2: Business
  const [businessName, setBusinessName] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('Dublin');
  const [country, setCountry] = useState('IE');
  const [currency, setCurrency] = useState('eur');

  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);

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

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setStep(2);
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!slugAvailable) {
      setError('Escolha um link disponível para sua página.');
      setLoading(false);
      return;
    }

    if (!termsAccepted) {
      setError('Você deve aceitar os Termos de Uso para criar uma conta.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          slug,
          businessName,
          category: category || null,
          city,
          country,
          currency,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Erro ao criar conta.');
        setLoading(false);
        return;
      }

      // Sign in the user after registration
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError('Conta criada! Faça login para continuar.');
        setLoading(false);
        router.push('/login');
        return;
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <CircleHoodLogoFull />
          </div>
          <CardTitle className="text-xl font-bold">Crie sua página profissional</CardTitle>
          <CardDescription>
            {step === 1
              ? 'Comece criando sua conta'
              : 'Agora, configure seu negócio'}
          </CardDescription>
          <div className="flex justify-center gap-2 pt-2">
            <div className={`h-2 w-16 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
            <div className={`h-2 w-16 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
          </div>
        </CardHeader>

        {step === 1 ? (
          <form onSubmit={handleStep1}>
            <CardContent className="space-y-4">
              {error && (
                <div data-testid="register-error" className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full">
                Continuar
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Já tem conta?{' '}
                <Link href="/login" className="text-primary underline hover:no-underline">
                  Fazer login
                </Link>
              </p>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              {error && (
                <div data-testid="register-error" className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="businessName">Nome do negócio *</Label>
                <Input
                  id="businessName"
                  placeholder="Ex: Maria's Nails"
                  value={businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Link da sua página *</Label>
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
                    <CheckCircle2 data-testid="slug-available-icon" className="h-5 w-5 text-green-500 shrink-0" />
                  )}
                  {!checkingSlug && slugAvailable === false && (
                    <XCircle data-testid="slug-unavailable-icon" className="h-5 w-5 text-destructive shrink-0" />
                  )}
                </div>
                {slugAvailable === false && (
                  <p data-testid="slug-error" className="text-xs text-destructive">Este link já está em uso.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade *</Label>
                <Input
                  id="city"
                  placeholder="Ex: Dublin, Lisboa, São Paulo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione sua área" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">País *</Label>
                <Select
                  value={country}
                  onValueChange={(val) => {
                    setCountry(val);
                    setCurrency(CURRENCY_BY_COUNTRY[val] ?? 'eur');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione seu país" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-xs text-muted-foreground">
                  💡 Você poderá adicionar bio, telefone, redes sociais e foto depois no painel!
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
                  Li e aceito os{' '}
                  <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                    Termos de Uso
                  </Link>
                  {' '}e a{' '}
                  <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
                    Política de Privacidade
                  </Link>
                </label>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar minha página
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep(1)}
              >
                Voltar
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
