'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface IdeaForm {
  title: string;
  description: string;
  impactsPayments: boolean;
  impactsBot: boolean;
  impactsEmail: boolean;
  impactsSecurity: boolean;
}

interface ErrorForm {
  where: string;
  message: string;
  environment: 'local' | 'staging' | 'prod';
  reproducible: boolean;
}

interface ChecklistItem {
  label: string;
  value: string;
  severity: 'green' | 'yellow' | 'red';
}

interface Entry {
  id: string;
  type: 'idea' | 'error';
  title: string;
  form_data: IdeaForm | ErrorForm;
  checklist: ChecklistItem[];
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

// ─── Analysis logic (pure, no API) ──────────────────────────────────────────

function analyzeIdea(form: IdeaForm): ChecklistItem[] {
  const items: ChecklistItem[] = [];

  // Risks
  const risks: string[] = [];
  if (form.impactsPayments) risks.push('Stripe checkout, webhooks, refunds');
  if (form.impactsBot) risks.push('Chatbot flow, Evolution API, message dedup');
  if (form.impactsEmail) risks.push('Resend templates, delivery, unsubscribe');
  if (form.impactsSecurity) risks.push('RLS policies, auth cookies, CORS');
  items.push({
    label: 'Riscos possiveis',
    value: risks.length > 0 ? risks.join(' | ') : 'Nenhum risco critico identificado',
    severity: risks.length >= 2 ? 'red' : risks.length === 1 ? 'yellow' : 'green',
  });

  // Tables
  const tables: string[] = [];
  if (form.impactsPayments) tables.push('payments', 'bookings', 'professionals (stripe_*)');
  if (form.impactsBot) tables.push('whatsapp_conversations', 'whatsapp_messages', 'whatsapp_config');
  if (form.impactsEmail) tables.push('retention_emails_sent', 'cron_logs');
  if (form.impactsSecurity) tables.push('professionals', 'support_tickets');
  items.push({
    label: 'Tabelas afetadas',
    value: tables.length > 0 ? tables.join(', ') : 'Nenhuma tabela diretamente',
    severity: tables.length > 3 ? 'red' : tables.length > 0 ? 'yellow' : 'green',
  });

  // APIs
  const apis: string[] = [];
  if (form.impactsPayments) apis.push('/api/bookings/checkout', '/api/webhooks/stripe-deposit', '/api/stripe/*');
  if (form.impactsBot) apis.push('/api/whatsapp/webhook', '/api/whatsapp/bot-toggle', '/api/whatsapp/send');
  if (form.impactsEmail) apis.push('/api/cron/send-reminders', '/api/cron/send-retention-emails', '/api/webhooks/resend');
  if (form.impactsSecurity) apis.push('/api/admin/*', '/api/auth/*', 'middleware.ts');
  items.push({
    label: 'APIs afetadas',
    value: apis.length > 0 ? apis.join(', ') : 'Nenhuma API diretamente',
    severity: apis.length > 3 ? 'red' : apis.length > 0 ? 'yellow' : 'green',
  });

  // Tests needed
  const tests: string[] = ['Unit: happy path + edge cases'];
  if (form.impactsPayments) tests.push('E2E: payment flow (pagamentos/sinal)', 'E2E: idempotencia critica');
  if (form.impactsBot) tests.push('E2E: bot E2E (@bot tag)', 'E2E: consistencia bot <-> pagina');
  if (form.impactsEmail) tests.push('E2E: notificacoes');
  if (form.impactsSecurity) tests.push('E2E: seguranca (auth, injecao)', 'E2E: GDPR');
  items.push({
    label: 'Testes necessarios',
    value: tests.join(' | '),
    severity: tests.length > 3 ? 'red' : 'yellow',
  });

  // Migration
  const needsMigration = form.impactsPayments || form.impactsSecurity;
  items.push({
    label: 'Precisa migration?',
    value: needsMigration ? 'Provavelmente SIM — revisar schema antes' : 'Provavelmente nao',
    severity: needsMigration ? 'red' : 'green',
  });

  // Stripe
  items.push({
    label: 'Impacta Stripe?',
    value: form.impactsPayments ? 'SIM — testar checkout, webhook, refund' : 'Nao',
    severity: form.impactsPayments ? 'red' : 'green',
  });

  // Webhook
  const impactsWebhook = form.impactsPayments || form.impactsBot;
  items.push({
    label: 'Impacta Webhook?',
    value: impactsWebhook
      ? 'SIM — ' +
        [form.impactsPayments && 'Stripe deposit webhook', form.impactsBot && 'Evolution webhook']
          .filter(Boolean)
          .join(', ')
      : 'Nao',
    severity: impactsWebhook ? 'yellow' : 'green',
  });

  // RLS
  items.push({
    label: 'Impacta RLS?',
    value: form.impactsSecurity
      ? 'SIM — verificar policies existentes e testar com anon/service role'
      : 'Nao diretamente',
    severity: form.impactsSecurity ? 'red' : 'green',
  });

  return items;
}

function analyzeError(form: ErrorForm): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const msg = (form.message + ' ' + form.where).toLowerCase();

  // Bug or missing test?
  items.push({
    label: 'Bug ou falta de teste?',
    value: form.reproducible
      ? 'Reproduzivel = provavelmente BUG real. Criar teste que falha antes do fix.'
      : 'Nao reproduzivel = pode ser race condition ou estado. Investigar logs.',
    severity: form.reproducible ? 'red' : 'yellow',
  });

  // Concurrency
  const isConcurrency =
    msg.includes('race') ||
    msg.includes('concurr') ||
    msg.includes('duplicate') ||
    msg.includes('conflict') ||
    msg.includes('409') ||
    msg.includes('deadlock');
  items.push({
    label: 'Problema de concorrencia?',
    value: isConcurrency
      ? 'PROVAVEL — verificar idempotency keys, locks, partial unique indexes'
      : 'Improvavel pelos dados informados',
    severity: isConcurrency ? 'red' : 'green',
  });

  // State problem
  const isState =
    msg.includes('undefined') ||
    msg.includes('null') ||
    msg.includes('state') ||
    msg.includes('stale') ||
    msg.includes('cache');
  items.push({
    label: 'Problema de estado?',
    value: isState
      ? 'PROVAVEL — verificar cache Redis, stale closures, re-renders'
      : 'Improvavel pelos dados informados',
    severity: isState ? 'yellow' : 'green',
  });

  // Data impact
  const isDataImpact =
    msg.includes('delete') ||
    msg.includes('update') ||
    msg.includes('insert') ||
    msg.includes('corrupt') ||
    msg.includes('wrong');
  items.push({
    label: 'Impacta dados?',
    value: isDataImpact
      ? 'POSSIVEL — verificar se dados foram corrompidos no DB'
      : 'Baixo risco de corrupcao de dados',
    severity: isDataImpact ? 'red' : 'green',
  });

  // Payment impact
  const isPayment =
    msg.includes('stripe') ||
    msg.includes('payment') ||
    msg.includes('checkout') ||
    msg.includes('deposit') ||
    msg.includes('refund');
  items.push({
    label: 'Impacta pagamento?',
    value: isPayment
      ? 'SIM — PRIORIDADE MAXIMA. Verificar status de payments no Stripe Dashboard.'
      : 'Nao identificado',
    severity: isPayment ? 'red' : 'green',
  });

  // Rollback
  items.push({
    label: 'Precisa rollback?',
    value:
      form.environment === 'prod' && (isDataImpact || isPayment)
        ? 'AVALIAR — erro em prod com impacto em dados/pagamento'
        : 'Provavelmente nao',
    severity: form.environment === 'prod' && (isDataImpact || isPayment) ? 'red' : 'green',
  });

  // Required test
  items.push({
    label: 'Teste obrigatorio a criar',
    value: form.reproducible
      ? 'Criar teste que reproduz o cenario ANTES do fix (deve falhar). Depois aplicar fix (deve passar).'
      : 'Criar teste de regressao cobrindo o caminho onde o erro foi reportado.',
    severity: 'yellow',
  });

  return items;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maxSeverity(checklist: ChecklistItem[]): 'green' | 'yellow' | 'red' {
  if (checklist.some((c) => c.severity === 'red')) return 'red';
  if (checklist.some((c) => c.severity === 'yellow')) return 'yellow';
  return 'green';
}

function SeverityDot({ severity }: { severity: 'green' | 'yellow' | 'red' }) {
  const colors = {
    green: 'bg-emerald-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500',
  };
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${colors[severity]} flex-shrink-0 mt-1`} />;
}

function TypeBadge({ type }: { type: 'idea' | 'error' }) {
  return type === 'idea' ? (
    <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase px-2 py-0.5">
      Ideia
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 text-[10px] font-bold uppercase px-2 py-0.5">
      Erro
    </span>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ControlCenterPage() {
  // Idea form
  const [idea, setIdea] = useState<IdeaForm>({
    title: '',
    description: '',
    impactsPayments: false,
    impactsBot: false,
    impactsEmail: false,
    impactsSecurity: false,
  });
  const [ideaResult, setIdeaResult] = useState<ChecklistItem[] | null>(null);

  // Error form
  const [error, setError] = useState<ErrorForm>({
    where: '',
    message: '',
    environment: 'local',
    reproducible: false,
  });
  const [errorResult, setErrorResult] = useState<ChecklistItem[] | null>(null);

  // Persisted entries
  const [entries, setEntries] = useState<Entry[]>([]);
  const [showResolved, setShowResolved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/control-center');
      if (res.ok) {
        setEntries(await res.json());
      }
    } catch {
      // silent — admin page, non-critical
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  async function saveEntry(type: 'idea' | 'error', title: string, formData: IdeaForm | ErrorForm, checklist: ChecklistItem[]) {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/control-center', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title, form_data: formData, checklist }),
      });
      if (res.ok) {
        const entry = await res.json();
        setEntries((prev) => [entry, ...prev]);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  async function resolveEntry(id: string) {
    setResolving(id);
    try {
      const res = await fetch(`/api/admin/control-center/${id}/resolve`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
      }
    } catch {
      // silent
    } finally {
      setResolving(null);
    }
  }

  function handleAnalyzeIdea() {
    const checklist = analyzeIdea(idea);
    setIdeaResult(checklist);
    saveEntry('idea', idea.title, idea, checklist);
  }

  function handleAnalyzeError() {
    const checklist = analyzeError(error);
    setErrorResult(checklist);
    saveEntry('error', error.where, error, checklist);
  }

  const pendingEntries = entries.filter((e) => !e.resolved);
  const resolvedEntries = entries.filter((e) => e.resolved);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Control Center</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Sistema operacional mental — analise antes de executar
        </p>
      </div>

      {/* ── REGRA GLOBAL (fixa no topo) ─────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-2">
          REGRA AUTOMATICA GLOBAL
        </p>
        <div className="font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 space-y-1">
          <p className="font-bold">TODA IMPLEMENTACAO DEVE:</p>
          <p>- Criar ou atualizar teste</p>
          <p>- Rodar build</p>
          <p>- Rodar typecheck</p>
          <p>- Rodar E2E</p>
          <p>- Nao fechar issue sem PR aprovado e CI verde</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── SECAO 1: NOVA IDEIA ──────────────────────────────────────────── */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-950 p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Nova Ideia
          </h2>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Titulo da ideia"
              value={idea.title}
              onChange={(e) => setIdea({ ...idea, title: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Descricao livre"
              value={idea.description}
              onChange={(e) => setIdea({ ...idea, description: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />

            <div className="grid grid-cols-2 gap-2">
              {([
                ['impactsPayments', 'Pagamentos'],
                ['impactsBot', 'Bot'],
                ['impactsEmail', 'Email'],
                ['impactsSecurity', 'Seguranca'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={idea[key]}
                    onChange={(e) => setIdea({ ...idea, [key]: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                  />
                  Impacta {label}?
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleAnalyzeIdea}
            disabled={!idea.title.trim() || saving}
            className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 transition-colors"
          >
            {saving ? 'SALVANDO...' : 'ANALISAR IDEIA'}
          </button>

          {/* Result */}
          {ideaResult && (
            <div className="space-y-2 pt-2 border-t border-blue-100 dark:border-blue-900">
              <p className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400">
                Analise: {idea.title}
              </p>
              {ideaResult.map((item, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <SeverityDot severity={item.severity} />
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.label}: </span>
                    <span className="text-slate-600 dark:text-slate-400">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── SECAO 2: NOVO ERRO ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-slate-950 p-5 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
            Novo Erro
          </h2>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Onde ocorreu? (arquivo, rota, tela)"
              value={error.where}
              onChange={(e) => setError({ ...error, where: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <textarea
              placeholder="Mensagem de erro"
              value={error.message}
              onChange={(e) => setError({ ...error, message: e.target.value })}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Ambiente
                </label>
                <select
                  value={error.environment}
                  onChange={(e) => setError({ ...error, environment: e.target.value as ErrorForm['environment'] })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="local">Local</option>
                  <option value="staging">Staging</option>
                  <option value="prod">Producao</option>
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={error.reproducible}
                    onChange={(e) => setError({ ...error, reproducible: e.target.checked })}
                    className="rounded border-slate-300 dark:border-slate-600 text-red-600 focus:ring-red-500"
                  />
                  Reproduzivel?
                </label>
              </div>
            </div>
          </div>

          <button
            onClick={handleAnalyzeError}
            disabled={!error.where.trim() || !error.message.trim() || saving}
            className="w-full rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 transition-colors"
          >
            {saving ? 'SALVANDO...' : 'ANALISAR ERRO'}
          </button>

          {/* Result */}
          {errorResult && (
            <div className="space-y-2 pt-2 border-t border-red-100 dark:border-red-900">
              <p className="text-xs font-bold uppercase text-red-600 dark:text-red-400">
                Analise: {error.where}
              </p>
              {errorResult.map((item, i) => (
                <div key={i} className="flex gap-2 text-xs">
                  <SeverityDot severity={item.severity} />
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.label}: </span>
                    <span className="text-slate-600 dark:text-slate-400">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SECAO 3: ITENS PENDENTES ──────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Itens Pendentes ({pendingEntries.length})
          </h2>
          <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600 text-slate-600 focus:ring-slate-500"
            />
            Mostrar resolvidos ({resolvedEntries.length})
          </label>
        </div>

        {pendingEntries.length === 0 && !showResolved && (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Nenhum item pendente. Analise uma ideia ou erro acima.
          </p>
        )}

        <div className="space-y-3">
          {pendingEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onResolve={() => resolveEntry(entry.id)}
              resolving={resolving === entry.id}
            />
          ))}

          {showResolved && resolvedEntries.length > 0 && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-600 mb-2">
                  Resolvidos
                </p>
              </div>
              {resolvedEntries.map((entry) => (
                <EntryCard key={entry.id} entry={entry} resolved />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Entry card ──────────────────────────────────────────────────────────────

function EntryCard({
  entry,
  onResolve,
  resolving,
  resolved,
}: {
  entry: Entry;
  onResolve?: () => void;
  resolving?: boolean;
  resolved?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const severity = maxSeverity(entry.checklist);

  return (
    <div
      className={`rounded-lg border p-3 text-xs transition-colors ${
        resolved
          ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-60'
          : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900'
      }`}
    >
      <div className="flex items-start gap-2">
        <SeverityDot severity={severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <TypeBadge type={entry.type} />
            <span className="font-bold text-slate-800 dark:text-slate-200 truncate">
              {entry.title}
            </span>
            <span className="text-slate-400 dark:text-slate-600 text-[10px]">
              {new Date(entry.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {expanded && (
            <div className="mt-2 space-y-1.5 pl-1">
              {entry.checklist.map((item, i) => (
                <div key={i} className="flex gap-2">
                  <SeverityDot severity={item.severity} />
                  <div>
                    <span className="font-bold text-slate-600 dark:text-slate-400">{item.label}: </span>
                    <span className="text-slate-500 dark:text-slate-500">{item.value}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="rounded px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          >
            {expanded ? 'Fechar' : 'Detalhes'}
          </button>
          {!resolved && onResolve && (
            <button
              onClick={onResolve}
              disabled={resolving}
              className="rounded px-2 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-40 transition-colors"
            >
              {resolving ? '...' : 'Resolver'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
