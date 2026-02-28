'use client';

import { useState } from 'react';
import { ArrowLeft, Copy, Check, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      title="Copiar"
    >
      {copied ? (
        <><Check className="h-3 w-3 text-green-500" /><span className="text-green-500">Copiado!</span></>
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </button>
  );
}

const testAccount = [
  { label: 'Email',             value: 'rita@teste.com',                          note: 'login no dashboard' },
  { label: 'Senha',             value: 'Teste1234',                               note: 'dashboard + Supabase Auth' },
  { label: 'User ID',           value: '4aa855dd-5c8d-4905-b51d-7671fc4a3b5b',   note: 'auth.users.id' },
  { label: 'Professional ID',   value: 'e8c8391f-22c0-4dbf-b0b2-718bb2b40974',   note: 'professionals.id' },
  { label: 'Telefone (bot)',     value: '353830326180',                            note: 'WhatsApp do Salão da Rita' },
  { label: 'Evolution Instance',value: 'prof-4aa855dd5c8d',                       note: 'instância no Evolution API' },
];

const testPhones = [
  { phone: '353800000001', use: 'API tests — agendamento público (01-public-booking)' },
  { phone: '353800000002', use: 'API tests — cliente 2 (double booking)' },
  { phone: '353800000091', use: 'Race condition — Cliente A' },
  { phone: '353800000092', use: 'Race condition — Cliente B' },
  { phone: '353800000093', use: 'Race condition — Cliente C' },
  { phone: '353800000098', use: 'Notificações — email failures test' },
  { phone: '353800000099', use: 'Idempotency, validation, lifecycle' },
];

const ciJobs = [
  { name: 'auth-setup',              desc: 'Login + salva sessão em .auth/user.json' },
  { name: 'bot-e2e',                 desc: 'Fluxo completo bot (saudação → agendamento)' },
  { name: 'reagendamento-bot',       desc: 'Reagendamento via bot' },
  { name: 'blocked-periods-bot',     desc: 'Bot rejeita períodos bloqueados' },
  { name: 'consistencia-bot-page',   desc: 'Consistência bot ↔ painel de agendamentos' },
  { name: 'critical-idempotency',    desc: 'Back-button não cria booking duplicado' },
  { name: 'critical-race',           desc: 'Double booking simultâneo bloqueado' },
  { name: 'notifications-email',     desc: 'Emails de confirmação/cancelamento' },
  { name: 'payment-e2e',             desc: 'Fluxo Stripe (sinal de reserva)' },
  { name: 'gdpr-legal-e2e',          desc: 'GDPR: exclusão de conta + dados' },
];

export default function HandbookDevPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl">
      <Link
        href="/admin/handbook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Handbook
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">🧪 Ambiente de Testes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conta de teste, telefones usados no CI e jobs do GitHub Actions
        </p>
      </div>

      {/* Conta de Teste */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base">Conta de Teste — Salão da Rita</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Conta permanente usada pelo Playwright em todos os testes de dashboard
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border overflow-hidden">
            {testAccount.map((row) => (
              <div key={row.label} className="flex items-center px-4 py-3 gap-4 bg-background hover:bg-muted/30 transition-colors">
                <span className="text-xs font-medium text-muted-foreground w-40 shrink-0">{row.label}</span>
                <code className="text-sm font-mono flex-1 break-all">{row.value}</code>
                <CopyButton value={row.value} />
                <span className="text-xs text-muted-foreground hidden sm:block w-56 text-right shrink-0">{row.note}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Telefones de Teste */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">📱 Telefones de Clientes (CI)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Cada suite de teste usa um phone dedicado para não interferir nas outras.
            O cleanup do CI remove bookings desses números antes e depois de cada run.
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border overflow-hidden">
            {testPhones.map((row) => (
              <div key={row.phone} className="flex items-center px-4 py-3 gap-4 bg-background hover:bg-muted/30 transition-colors">
                <code className="text-sm font-mono w-36 shrink-0">{row.phone}</code>
                <CopyButton value={row.phone} />
                <span className="text-sm text-muted-foreground">{row.use}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ℹ️ Cleanup cobre: nomes contendo <code className="bg-muted px-1 rounded">E2E|Teste|Race|Chegou|Idempot|Concurrent</code> + phones <code className="bg-muted px-1 rounded">353800000*</code>
          </p>
        </CardContent>
      </Card>

      {/* Jobs CI */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">⚙️ Jobs do CI (GitHub Actions)</CardTitle>
          <p className="text-xs text-muted-foreground">
            22 jobs no total — rodam contra produção (<code className="bg-muted px-1 rounded">booking.circlehood-tech.com</code>)
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border overflow-hidden">
            {ciJobs.map((job) => (
              <div key={job.name} className="flex items-center px-4 py-3 gap-4 bg-background hover:bg-muted/30 transition-colors">
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 w-52 shrink-0">{job.name}</code>
                <span className="text-sm text-muted-foreground">{job.desc}</span>
              </div>
            ))}
            <div className="px-4 py-3 bg-muted/20">
              <p className="text-xs text-muted-foreground">+ 12 outros jobs (analytics, settings, services, bookings-manager, etc.)</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nota importante */}
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardContent className="p-4">
          <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-1">⚠️ Importante</p>
          <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
            <li>• Não muda a senha ou email da conta <strong>rita@teste.com</strong> — o CI vai quebrar</li>
            <li>• Não apaga serviços/horários da conta Rita — testes dependem deles</li>
            <li>• Se o CI falhar misteriosamente: verifica se a conta Rita ainda existe no Supabase Auth</li>
            <li>• UUIDs de teste devem ter formato v4 válido: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">00000000-0000-4000-a000-000000000001</code></li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
