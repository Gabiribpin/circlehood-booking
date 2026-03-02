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

const marketingAccounts = [
  {
    locale: 'PT-BR 🇧🇷',
    name: 'Ana Martins Beauty Studio',
    category: 'Cabeleireira & Esteticista',
    email: 'profissional@circlehoodtech.com',
    password: 'Marketing2026Abc',
    slug: 'ana-martins-beauty',
    account: 'ACC-2026-00243',
    userId: '191a7eda-bcad-4611-b014-2be699c5a666',
    profId: '4784ed7a-02e2-4daa-b81c-dda2c5967cf9',
    deposit: '20% (percentual)',
    services: 'Corte Feminino (€35), Coloração Completa (€85), Mechas/Balayage (€120), Escova Progressiva (€150), Limpeza de Pele (€55), Corte+Escova (€50)',
    data: '6 serviços, 12 contatos, 19 agendamentos',
  },
  {
    locale: 'EN-US 🇮🇪',
    name: 'Sophie Clarke Wellness',
    category: 'Massage Therapist',
    email: 'professional@circlehoodtech.com',
    password: 'Marketing2026Eng',
    slug: 'sophie-clarke-wellness',
    account: 'ACC-2026-00244',
    userId: 'de6870f7-70eb-442a-b976-569f653ca105',
    profId: 'cd326e66-e4d9-4a78-a920-c394c31669a2',
    deposit: '€15 (fixo)',
    services: 'Swedish Massage (€70), Deep Tissue (€80), Sports Recovery (€65), Hot Stone (€90), Prenatal (€75), Home Visit (€110)',
    data: '6 services, 12 contacts, 19 bookings',
  },
  {
    locale: 'ES-ES 🇪🇸',
    name: 'Laura Garcia Estética',
    category: 'Esteticista & Masajista',
    email: 'profesional@circlehoodtech.com',
    password: 'Marketing2026Esp',
    slug: 'laura-garcia-estetica',
    account: 'ACC-2026-00245',
    userId: '515e490b-8e97-4bc2-9a2d-2e9f13d30ab9',
    profId: '53b79dbc-4b67-47fd-ad7a-0ee3b7a760fc',
    deposit: 'Desativado',
    services: 'Limpieza Facial (€55), Masaje Relajante (€65), Antiedad (€95), Drenaje Linfático (€70), Manicura (€35), Masaje a Domicilio (€100)',
    data: '6 servicios, 12 contactos, 19 citas',
  },
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
  { name: 'Vitest (unit)',                       desc: 'Testes unitários — roda primeiro, bloqueia tudo se falhar', required: true },
  { name: 'Playwright (smoke público)',          desc: 'Cross-browser (Chromium, WebKit, Firefox)', required: true },
  { name: 'Playwright (dashboard autenticado)',  desc: 'Testes com sessão logada', required: true },
  { name: 'Playwright (API pública + ciclo)',    desc: 'APIs públicas e ciclo profissional', required: true },
  { name: 'Playwright (segurança)',              desc: 'Endpoints protegidos retornam 401/403', required: true },
  { name: 'Playwright (jornada do usuário)',     desc: 'Registro → onboarding → dashboard', required: true },
  { name: 'Playwright (navegação)',              desc: 'Links, menu, rotas', required: true },
  { name: 'Playwright (UX consistency)',         desc: 'Consistência visual', required: true },
  { name: 'Playwright (i18n)',                   desc: 'Troca de idiomas pt-BR/en-US/es-ES', required: true },
  { name: 'Playwright (notificações)',           desc: 'Emails de confirmação/cancelamento', required: true },
  { name: 'Playwright (mobile)',                 desc: 'Responsividade e mobile nav', required: true },
  { name: 'Playwright (race condition)',         desc: 'Double booking simultâneo bloqueado', required: true },
  { name: 'Playwright (idempotência)',           desc: 'Back-button não cria booking duplicado', required: true },
  { name: 'Playwright (bot E2E) 💰',            desc: 'Fluxo completo bot — roda após os 13 acima', required: false },
  { name: 'Playwright (reagendamento bot)',      desc: 'Reagendamento via bot', required: false },
  { name: 'Playwright (bloqueio bot)',           desc: 'Bot rejeita períodos bloqueados', required: false },
  { name: 'Playwright (consistência bot)',       desc: 'Consistência bot ↔ painel', required: false },
  { name: 'Playwright (pagamentos)',             desc: 'Fluxo Stripe (sinal de reserva)', required: false },
  { name: 'Playwright (GDPR)',                   desc: 'Exclusão de conta + dados', required: false },
  { name: 'Cleanup test database',               desc: 'Limpa dados de teste do banco', required: false },
];

export default function HandbookDevPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 max-w-4xl">
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
              <div key={row.label} className="flex flex-wrap sm:flex-nowrap items-center px-3 sm:px-4 py-3 gap-2 sm:gap-4 bg-background hover:bg-muted/30 transition-colors">
                <span className="text-xs font-medium text-muted-foreground w-full sm:w-40 shrink-0">{row.label}</span>
                <code className="text-xs sm:text-sm font-mono flex-1 break-all min-w-0">{row.value}</code>
                <CopyButton value={row.value} />
                <span className="text-xs text-muted-foreground hidden lg:block w-56 text-right shrink-0">{row.note}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Contas de Marketing */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">📸</span>
            <CardTitle className="text-base">Contas de Marketing — Screenshots</CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Perfis completos com dados fake para prints de marketing. Cada um em um idioma diferente.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {marketingAccounts.map((acc) => (
            <div key={acc.email} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                  {acc.locale}
                </span>
                <span className="text-sm font-semibold">{acc.name}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">— {acc.category}</span>
              </div>
              <div className="divide-y rounded-lg border overflow-hidden">
                {[
                  { label: 'Email', value: acc.email },
                  { label: 'Senha', value: acc.password },
                  { label: 'Página pública', value: `/${acc.slug}` },
                  { label: 'Account', value: acc.account },
                  { label: 'Depósito', value: acc.deposit },
                  { label: 'User ID', value: acc.userId },
                  { label: 'Professional ID', value: acc.profId },
                ].map((row) => (
                  <div key={row.label} className="flex flex-wrap sm:flex-nowrap items-center px-3 sm:px-4 py-2 gap-1 sm:gap-4 bg-background hover:bg-muted/30 transition-colors">
                    <span className="text-xs font-medium text-muted-foreground w-full sm:w-32 shrink-0">{row.label}</span>
                    <code className="text-xs font-mono flex-1 break-all min-w-0">{row.value}</code>
                    <CopyButton value={row.value} />
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pl-1">
                📦 {acc.data} — Serviços: {acc.services}
              </p>
            </div>
          ))}
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
              <div key={row.phone} className="flex flex-wrap sm:flex-nowrap items-center px-3 sm:px-4 py-3 gap-2 sm:gap-4 bg-background hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-2">
                  <code className="text-xs sm:text-sm font-mono shrink-0">{row.phone}</code>
                  <CopyButton value={row.phone} />
                </div>
                <span className="text-xs sm:text-sm text-muted-foreground">{row.use}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            ℹ️ Cleanup cobre: nomes contendo <code className="bg-muted px-1 rounded">E2E|Teste|Race|Chegou|Idempot|Concurrent</code> + phones <code className="bg-muted px-1 rounded">353800000*</code>
          </p>
        </CardContent>
      </Card>

      {/* Branch Protection */}
      <Card className="border-green-300 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🔒 Branch Protection (main)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Configurada para impedir código quebrado em produção
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm space-y-2">
            <p className="font-medium text-green-800 dark:text-green-300">Regras ativas:</p>
            <ul className="space-y-1.5 text-green-700 dark:text-green-400 text-xs">
              <li>• <strong>Push direto em main: BLOQUEADO</strong> — toda mudança precisa de PR</li>
              <li>• <strong>13 checks CI obrigatórios</strong> — merge só com todos verdes</li>
              <li>• <strong>strict: true</strong> — branch deve estar atualizada com main</li>
              <li>• <strong>Aprovações: 0</strong> — sem friction extra (equipe de 1 pessoa)</li>
              <li>• <strong>Force push: desabilitado</strong> — previne perda de histórico</li>
            </ul>
          </div>
          <div className="text-sm space-y-2">
            <p className="font-medium text-green-800 dark:text-green-300">Fluxo de deploy:</p>
            <div className="bg-green-100 dark:bg-green-900/30 rounded-lg p-3 font-mono text-xs text-green-800 dark:text-green-300 space-y-1">
              <p>1. git checkout -b fix/nome-do-fix</p>
              <p>2. git commit → git push -u origin fix/nome-do-fix</p>
              <p>3. gh pr create --title &quot;Fix: descrição&quot;</p>
              <p>4. CI roda (13 checks) → tudo verde → merge</p>
              <p>5. main atualizada → Vercel deploya automaticamente</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs CI */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">⚙️ Jobs do CI (GitHub Actions)</CardTitle>
          <p className="text-xs text-muted-foreground">
            22 jobs no total — rodam contra produção (<code className="bg-muted px-1 rounded">booking.circlehood-tech.com</code>).
            Os 13 marcados como <span className="text-green-600 font-bold">obrigatório</span> bloqueiam o merge se falharem.
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border overflow-hidden">
            {ciJobs.map((job) => (
              <div key={job.name} className="flex items-center px-4 py-3 gap-3 bg-background hover:bg-muted/30 transition-colors flex-wrap">
                {job.required ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400 shrink-0">obrigatório</span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 shrink-0">opcional</span>
                )}
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 flex-1 min-w-0">{job.name}</code>
                <span className="text-xs text-muted-foreground w-full sm:w-auto">{job.desc}</span>
              </div>
            ))}
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
