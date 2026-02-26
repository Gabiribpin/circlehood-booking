'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { CircleHoodLogoFull } from '@/components/branding/logo';

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<'errorInvalidCredentials' | 'errorGeneric' | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorKey(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // "Invalid login credentials" covers both wrong password and email not found
      const isCredentialsError =
        error.message.toLowerCase().includes('invalid login credentials') ||
        error.message.toLowerCase().includes('user not found') ||
        error.status === 400;

      setErrorKey(isCredentialsError ? 'errorInvalidCredentials' : 'errorGeneric');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  const registerHref = locale === 'pt-BR' ? '/register' : `/${locale}/register`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <CircleHoodLogoFull />
          </div>
          <div>
            <CardTitle className="text-xl font-bold">Entrar na sua conta</CardTitle>
            <CardDescription>Gerencie seus agendamentos</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {errorKey && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                {t.rich(errorKey, {
                  link: (chunks) => (
                    <Link
                      href={registerHref}
                      className="underline font-medium hover:no-underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Esqueceu a senha?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Ainda não tem conta?{' '}
              <Link href={registerHref} className="text-primary underline hover:no-underline">
                Cadastre-se grátis
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
