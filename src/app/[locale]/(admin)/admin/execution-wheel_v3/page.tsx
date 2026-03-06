'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Lightbulb,
  AlertTriangle,
  ArrowRight,
  Copy,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  GitBranch,
  Shield,
  CheckCircle2,
  Plus,
  Link2,
  Rocket,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface InboxItem {
  id: string;
  created_at: string;
  type: 'idea' | 'error';
  title: string;
  raw_text: string;
  status: 'new' | 'triaged' | 'converted';
  severity: string | null;
  area: string[];
  needs_info: string[];
  duplicates: unknown[];
  github_issue_number: number | null;
  github_issue_url: string | null;
}

interface GHLabel {
  name: string;
  color: string;
}

interface GHIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: GHLabel[];
  pull_request?: unknown;
  node_id: string;
}

interface DedupSuggestion {
  number: number;
  title: string;
  html_url: string;
  score: number;
}

interface Focus {
  number: number;
  title: string;
  url: string;
  labels: string[];
  node_id?: string;
}

type V3Phase =
  | 'ready'            // Issue aberta, sem branch
  | 'awaiting-tests'   // Branch existe, CI local não rodou
  | 'testing'          // CI local rodando
  | 'local-ok'         // CI local passou
  | 'ready-for-pr'     // Revisão ok, pronto para PR
  | 'pr-open'          // PR aberto + auto-merge ativo
  | 'done';            // CI verde → mergeado

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITY = ['blocker', 'critical', 'high', 'medium', 'low', 'enhancement'] as const;
const LS_FOCUS_V3 = 'wheel_v3.focus';
const LS_PHASE_V3 = 'wheel_v3.phase';
const PROJECT_URL = 'https://github.com/users/Gabiribpin/projects/7';

const PHASE_CONFIG: Record<V3Phase, { emoji: string; label: string; color: string }> = {
  'ready':           { emoji: '🔵', label: 'PRONTO PARA EXECUTAR',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  'awaiting-tests':  { emoji: '🟠', label: 'AGUARDANDO TESTES',      color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  'testing':         { emoji: '🔄', label: 'TESTANDO',                color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  'local-ok':        { emoji: '🟢', label: 'LOCAL OK',                color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  'ready-for-pr':    { emoji: '🟣', label: 'PRONTO PARA PR',         color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  'pr-open':         { emoji: '🚀', label: 'PR ABERTO',               color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  'done':            { emoji: '✅', label: 'CONCLUÍDO',               color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function labelsOf(issue: GHIssue): string[] {
  return issue.labels.map((l) => l.name).filter(Boolean);
}

function getSeverity(labels: string[]): string {
  for (const p of PRIORITY) {
    if (labels.includes(p)) return p;
  }
  return 'medium';
}

function severityScore(sev: string): number {
  const idx = PRIORITY.indexOf(sev as (typeof PRIORITY)[number]);
  return idx === -1 ? 999 : idx;
}

function getEffortScore(labels: string[]): number {
  const s = new Set(labels);
  if (s.has('effort:low') || s.has('size:S')) return 1;
  if (s.has('effort:high') || s.has('size:L')) return 3;
  return 2;
}

function sevColor(sev: string): string {
  if (sev === 'blocker') return 'bg-red-600 text-white';
  if (sev === 'critical') return 'bg-amber-500 text-black';
  if (sev === 'high') return 'bg-orange-400 text-black';
  if (sev === 'medium') return 'bg-yellow-300 text-black';
  if (sev === 'low') return 'bg-sky-300 text-black';
  return 'bg-slate-500 text-white';
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'work';
}

function branchName(f: Focus): string {
  return `fix/issue-${f.number}-${slugify(f.title)}`;
}

function labelBadgeColor(hex: string): string {
  return `bg-[#${hex}] text-white`;
}

function suggestSeverity(text: string): string {
  const t = text.toLowerCase();
  if (/payment|stripe|refund|cobranca/.test(t)) return 'critical';
  if (/auth|login|security|rls|senha/.test(t)) return 'critical';
  if (/bot|booking falh|email falh|webhook/.test(t)) return 'high';
  if (/ui|layout|css|i18n|visual/.test(t)) return 'medium';
  if (/idea|ideia|sugestao|melhoria/.test(t)) return 'low';
  return 'medium';
}

function suggestMissingInfo(item: { raw_text: string; type: string; area: string[] }): string[] {
  const missing: string[] = [];
  if (item.raw_text.length < 30) missing.push('Descricao detalhada');
  if (item.type === 'error' && !/log|erro|stack|trace/i.test(item.raw_text)) missing.push('Log de erro');
  if (item.area.length === 0) missing.push('Area(s) afetada(s)');
  return missing;
}

function pickNext(issues: GHIssue[]): GHIssue | null {
  const open = issues.filter((i) => i.state === 'open' && !i.pull_request);
  if (!open.length) return null;
  open.sort((a, b) => {
    const la = labelsOf(a), lb = labelsOf(b);
    const d1 = severityScore(getSeverity(la)) - severityScore(getSeverity(lb));
    if (d1 !== 0) return d1;
    const d2 = getEffortScore(la) - getEffortScore(lb);
    if (d2 !== 0) return d2;
    return a.number - b.number;
  });
  return open[0];
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Prompt Generators ──────────────────────────────────────────────────────

function generateExecutionPrompt(f: Focus, issueBody: string): string {
  return [
    '# EXECUTION MODE v3 — Local First',
    '',
    '## Issue a resolver',
    `#${f.number} — ${f.title}`,
    `Link: ${f.url}`,
    `Labels: ${f.labels.join(', ') || '(nenhuma)'}`,
    '',
    'Contexto da issue:',
    issueBody,
    '',
    '## Passos',
    '',
    '1. Leia a issue completamente',
    `2. Crie a branch: git checkout -b ${branchName(f)}`,
    '3. Faca APENAS as alteracoes que a issue descreve',
    '4. Suba o ambiente local:',
    '   - supabase start (se nao estiver rodando)',
    '   - npm run dev (se nao estiver rodando)',
    '5. Rode os testes locais contra localhost:',
    '   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test',
    '6. Rode os unit tests:',
    '   npm run test',
    `7. Se tudo passar, faca commit:`,
    `   git commit -m "fix: [descricao] (#${f.number})"`,
    '   SEM Closes #X no commit',
    '   NAO faca push ainda — aguarde aprovacao da usuaria',
  ].join('\n');
}

function generateTestPrompt(f: Focus): string {
  return [
    '# TEST MODE v3 — Validacao Local',
    '',
    `## Issue #${f.number} — ${f.title}`,
    `Branch: ${branchName(f)}`,
    '',
    '## Passos',
    '',
    '1. Confirme que o ambiente local esta de pe:',
    '   supabase status',
    '   curl http://localhost:3000',
    '2. Rode os unit tests:',
    '   npm run test',
    '3. Rode os testes Playwright contra localhost:',
    '   PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test',
    '4. Rode o typecheck:',
    '   npx tsc --noEmit',
    '5. Reporte o resultado completo.',
    '',
    'Se qualquer teste falhar, investigue e corrija antes de prosseguir.',
  ].join('\n');
}

function generateReviewPrompt(f: Focus): string {
  return [
    `# REVIEW MODE v3 — Issue #${f.number}`,
    '',
    `Titulo: ${f.title}`,
    '',
    'Nao confie na implementacao anterior.',
    'Prove que a issue esta realmente resolvida.',
    '',
    '1) Liste todos os arquivos alterados.',
    '2) Mostre o diff relevante.',
    '3) Mostre o teste que cobre o problema.',
    '4) Mostre o output completo do runner de testes.',
    '5) Explique por que o bug nao pode mais ocorrer.',
    '6) Liste possiveis regressoes e por que nao acontecem.',
    '',
    'Se qualquer item acima nao estiver completo,',
    'a issue deve ser considerada NAO resolvida.',
  ].join('\n');
}

function generateDeployPrompt(f: Focus): string {
  return [
    '# DEPLOY MODE v3 — PR sem Vercel',
    '',
    `## Issue #${f.number} — ${f.title}`,
    '',
    'Testes locais aprovados. Agora:',
    '',
    `1. git push -u origin ${branchName(f)}`,
    '2. gh pr create \\',
    `     --title "fix: ${f.title} (#${f.number})" \\`,
    `     --body "## O que foi feito\\n[descricao]\\n\\nCloses #${f.number}" \\`,
    '     --base main',
    '3. gh pr merge --auto --squash',
    '4. O CI local (ci-local.yml) vai rodar no GitHub',
    '5. Quando verde -> merge automatico -> issue fecha',
    '6. Vercel nao e consultado.',
  ].join('\n');
}

function generateAuditPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return [
    'MODO AUDITORIA COMPLETA — EXECUCAO TRANSPARENTE',
    '',
    'Executar varredura tecnica completa.',
    '',
    'Analisar:',
    '- API routes',
    '- Banco de dados',
    '- Pagamentos',
    '- Seguranca',
    '- Frontend',
    '- Build e dependencias',
    '',
    'Classificar em:',
    'BLOCKER / CRITICAL / HIGH / MEDIUM / LOW / ENHANCEMENT',
    '',
    'Para cada problema:',
    '- Evidencia (arquivo/linha)',
    '- Impacto real',
    '- Correcao minima',
    '- Estimativa de esforco',
    '',
    'Gerar:',
    `- docs/AUDIT_${today}.md`,
    '- Criar issues no GitHub com labels corretas',
    '- Atualizar Project',
    '',
    'Mostrar resumo final com veredito:',
    'PRONTO ou NAO PRONTO.',
  ].join('\n');
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExecutionWheelV3Page() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Inbox state
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxFilter, setInboxFilter] = useState<{ status?: string; type?: string; search?: string }>({});
  const [captureType, setCaptureType] = useState<'idea' | 'error' | null>(null);
  const [captureText, setCaptureText] = useState('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Launch Gate state
  const [ghIssues, setGhIssues] = useState<GHIssue[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghError, setGhError] = useState('');

  // Dedup state
  const [dedupSuggestions, setDedupSuggestions] = useState<DedupSuggestion[]>([]);
  const [dedupLoading, setDedupLoading] = useState(false);

  // Focus state
  const [focus, setFocus] = useState<Focus | null>(null);

  // V3 Phase state
  const [phase, setPhase] = useState<V3Phase>('ready');
  const [phaseLoading, setPhaseLoading] = useState(false);

  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  // Load saved focus + phase
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_FOCUS_V3);
      if (saved) setFocus(JSON.parse(saved));
      const savedPhase = localStorage.getItem(LS_PHASE_V3);
      if (savedPhase) setPhase(savedPhase as V3Phase);
    } catch { /* ignore */ }
  }, []);

  // Save focus + phase
  useEffect(() => {
    if (focus) localStorage.setItem(LS_FOCUS_V3, JSON.stringify(focus));
    else localStorage.removeItem(LS_FOCUS_V3);
  }, [focus]);

  useEffect(() => {
    localStorage.setItem(LS_PHASE_V3, phase);
  }, [phase]);

  // ─── Inbox API ──────────────────────────────────────────────────────────

  const loadInbox = useCallback(async (filters?: typeof inboxFilter) => {
    setInboxLoading(true);
    try {
      const f = filters || inboxFilter;
      const params = new URLSearchParams();
      if (f.status) params.set('status', f.status);
      if (f.type) params.set('type', f.type);
      if (f.search) params.set('search', f.search);
      const qs = params.toString();
      const data = await apiFetch(`/api/admin/inbox${qs ? `?${qs}` : ''}`);
      setInboxItems(data);
    } catch (e) {
      log(`ERRO inbox: ${(e as Error).message}`);
    } finally {
      setInboxLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inboxFilter]);

  const createInboxItem = useCallback(async (type: 'idea' | 'error', raw_text: string) => {
    try {
      const item = await apiFetch('/api/admin/inbox', {
        method: 'POST',
        body: JSON.stringify({ type, raw_text }),
      });
      log(`Capturado: "${item.title}" (${type})`);
      setCaptureType(null);
      setCaptureText('');
      await loadInbox();
    } catch (e) {
      log(`ERRO captura: ${(e as Error).message}`);
    }
  }, [log, loadInbox]);

  const updateInboxItem = useCallback(async (id: string, updates: Partial<InboxItem>) => {
    try {
      await apiFetch('/api/admin/inbox', {
        method: 'PATCH',
        body: JSON.stringify({ id, ...updates }),
      });
      await loadInbox();
    } catch (e) {
      log(`ERRO update: ${(e as Error).message}`);
    }
  }, [log, loadInbox]);

  const triageItem = useCallback(async (item: InboxItem) => {
    const severity = suggestSeverity(item.raw_text);
    const needs_info = suggestMissingInfo(item);
    await updateInboxItem(item.id, { status: 'triaged', severity, needs_info });
    log(`Triado: "${item.title}" -> ${severity.toUpperCase()}`);
  }, [updateInboxItem, log]);

  const convertToIssue = useCallback(async (item: InboxItem) => {
    try {
      const labels = [item.type === 'idea' ? 'enhancement' : 'bug'];
      if (item.severity) labels.push(item.severity);

      const result = await apiFetch('/api/admin/github/issues', {
        method: 'POST',
        body: JSON.stringify({
          title: item.title,
          description: item.raw_text,
          labels,
        }),
      });

      try {
        await apiFetch('/api/admin/github/project', {
          method: 'POST',
          body: JSON.stringify({ content_id: result.node_id }),
        });
        log(`Issue #${result.number} adicionada ao Project`);
      } catch {
        log(`Issue #${result.number} criada (falha ao adicionar ao Project)`);
      }

      await updateInboxItem(item.id, {
        status: 'converted',
        github_issue_number: result.number,
        github_issue_url: result.html_url,
      });

      log(`Convertido: "${item.title}" -> Issue #${result.number}`);
    } catch (e) {
      log(`ERRO conversao: ${(e as Error).message}`);
    }
  }, [updateInboxItem, log]);

  // ─── GitHub Issues API ──────────────────────────────────────────────────

  const loadGhIssues = useCallback(async () => {
    setGhLoading(true);
    setGhError('');
    try {
      const issues = await apiFetch('/api/admin/github/issues?action=list');
      setGhIssues(issues);
      log(`Launch Gate: ${issues.length} issues abertas`);

      // Check if focused issue was closed
      setFocus((currentFocus) => {
        if (!currentFocus) return null;
        const stillOpen = issues.find((i: GHIssue) => i.number === currentFocus.number && !i.pull_request);
        if (stillOpen) {
          return { ...currentFocus, labels: labelsOf(stillOpen) };
        }
        // Issue was closed — recalculate
        log('Issue focada foi fechada. Recalculando...');
        const next = pickNext(issues.filter((i: GHIssue) => !i.pull_request));
        if (next) {
          const f: Focus = { number: next.number, title: next.title, url: next.html_url, labels: labelsOf(next), node_id: next.node_id };
          log(`Novo foco: #${next.number} — ${next.title}`);
          setPhase('ready');
          return f;
        }
        return null;
      });

      // After loading issues, check if focused issue has a PR open — auto-advance
      // This runs after setFocus above resolves
      setFocus((currentFocus) => {
        if (!currentFocus) return null;
        // We'll check PR status asynchronously below
        return currentFocus;
      });

      // Check PR status for focused issue and auto-advance if PR exists
      const currentFocusSnapshot = focus;
      if (currentFocusSnapshot) {
        try {
          const branch = branchName(currentFocusSnapshot);
          const prData = await apiFetch(`/api/admin/github/issues?action=pr-status&branch=${encodeURIComponent(branch)}`);
          if (prData.hasPR) {
            log(`Issue #${currentFocusSnapshot.number} tem PR (${prData.prState}). Avancando...`);
            const openWithoutPR = issues.filter((i: GHIssue) => !i.pull_request && i.number !== currentFocusSnapshot.number);
            const next = pickNext(openWithoutPR);
            if (next) {
              const f: Focus = { number: next.number, title: next.title, url: next.html_url, labels: labelsOf(next), node_id: next.node_id };
              setFocus(f);
              setPhase('ready');
              log(`Novo foco: #${next.number} — ${next.title}`);
            } else {
              setFocus(null);
              log('Nenhuma issue sem PR disponivel.');
            }
          }
        } catch {
          // PR status check failed — keep current focus
        }
      }
    } catch (e) {
      const msg = (e as Error).message;
      setGhError(msg);
      log(`ERRO GitHub: ${msg}`);
    } finally {
      setGhLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log, focus]);

  // Dedup search
  const searchDedup = useCallback(async (text: string) => {
    if (text.length < 10) { setDedupSuggestions([]); return; }
    setDedupLoading(true);
    try {
      const stopwords = new Set(['a','o','e','de','da','do','em','para','com','que','um','uma','no','na','se','por','ao','os','as','das','dos','nos','nas','mais','como','ser','ter','foi','esta','isso','esse','essa','qual','quando','onde']);
      const words = text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 2 && !stopwords.has(w));
      const query = words.slice(0, 3).join(' ');
      if (!query) { setDedupSuggestions([]); return; }

      const results = await apiFetch(`/api/admin/github/issues?action=search&q=${encodeURIComponent(query)}`);
      const suggestions: DedupSuggestion[] = (results || []).slice(0, 5).map((r: { number: number; title: string; html_url: string; score?: number }) => ({
        number: r.number,
        title: r.title,
        html_url: r.html_url,
        score: r.score || 0,
      }));
      setDedupSuggestions(suggestions);
    } catch {
      setDedupSuggestions([]);
    } finally {
      setDedupLoading(false);
    }
  }, []);

  // ─── Phase Detection ──────────────────────────────────────────────────

  const detectPhase = useCallback(async (f: Focus | null) => {
    if (!f) {
      const openCount = ghIssues.filter((i) => !i.pull_request).length;
      if (openCount === 0) setPhase('ready');
      return;
    }

    setPhaseLoading(true);
    try {
      const branch = branchName(f);
      const data = await apiFetch(`/api/admin/github/issues?action=pr-status&branch=${encodeURIComponent(branch)}`);

      if (!data.hasPR) {
        // No PR — check CI local workflow
        setPhase('ready');
      } else if (data.prState === 'merged') {
        setPhase('done');
      } else if (data.prState === 'open' && data.ciStatus === 'failure') {
        setPhase('pr-open'); // PR open, CI running or failing
      } else if (data.prState === 'open' && data.ciStatus === 'success') {
        setPhase('done'); // will auto-merge
      } else if (data.prState === 'open') {
        setPhase('pr-open');
      } else {
        setPhase('ready');
      }
    } catch {
      // API error — default to ready (no PR found)
      setPhase('ready');
    } finally {
      setPhaseLoading(false);
    }
  }, [ghIssues]);

  useEffect(() => {
    detectPhase(focus);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, ghIssues]);

  // ─── Focus Actions ──────────────────────────────────────────────────────

  function focusIssue(issue: GHIssue) {
    const f: Focus = {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      labels: labelsOf(issue),
      node_id: issue.node_id,
    };
    setFocus(f);
    setPhase('ready');
    setActiveTab('focus');
    log(`Foco: #${issue.number} — ${issue.title}`);
  }

  function pullNext() {
    const next = pickNext(ghIssues);
    if (next) {
      focusIssue(next);
    } else {
      log('Nenhuma issue disponivel para focar.');
    }
  }

  // ─── Prompt Copy ──────────────────────────────────────────────────────

  async function copySmartPrompt() {
    if (!focus) {
      // Audit mode
      try {
        await navigator.clipboard.writeText(generateAuditPrompt());
        log('Prompt de auditoria copiado');
      } catch {
        log('ERRO: falha ao copiar para clipboard.');
      }
      return;
    }

    let text = '';
    const phaseName = PHASE_CONFIG[phase].label;

    switch (phase) {
      case 'ready': {
        let issueBody = '(sem descricao)';
        try {
          const data = await apiFetch(`/api/admin/github/issues?action=get&number=${focus.number}`);
          if (data.body) issueBody = data.body;
        } catch { /* use fallback */ }
        text = generateExecutionPrompt(focus, issueBody);
        break;
      }
      case 'awaiting-tests':
      case 'testing':
        text = generateTestPrompt(focus);
        break;
      case 'local-ok':
        text = generateReviewPrompt(focus);
        break;
      case 'ready-for-pr':
        text = generateDeployPrompt(focus);
        break;
      case 'pr-open':
        text = [
          `# PR ABERTO — Issue #${focus.number}`,
          '',
          'O PR ja esta aberto com auto-merge ativo.',
          'Aguarde o CI local rodar no GitHub.',
          '',
          'Comandos uteis:',
          '  gh pr checks',
          '  gh pr view',
          '',
          'Se CI falhar:',
          '  gh run view [RUN_ID] --log-failed',
          '  Corrija, commit, push — CI roda novamente.',
        ].join('\n');
        break;
      case 'done':
        text = `Issue #${focus.number} concluida. Selecione a proxima issue.`;
        break;
    }

    try {
      await navigator.clipboard.writeText(text);
      log(`Prompt ${phaseName} copiado — #${focus.number}`);
    } catch {
      log('ERRO: falha ao copiar para clipboard.');
    }
  }

  async function copyBranch() {
    if (!focus) return;
    try {
      await navigator.clipboard.writeText(branchName(focus));
      log(`Branch copiada: ${branchName(focus)}`);
    } catch {
      log('ERRO: falha ao copiar.');
    }
  }

  // ─── Phase Transitions ────────────────────────────────────────────────

  const PHASE_ORDER: V3Phase[] = ['ready', 'awaiting-tests', 'testing', 'local-ok', 'ready-for-pr', 'pr-open', 'done'];

  function advancePhase() {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx < PHASE_ORDER.length - 1) {
      const next = PHASE_ORDER[idx + 1];
      setPhase(next);
      log(`Fase: ${PHASE_CONFIG[next].emoji} ${PHASE_CONFIG[next].label}`);
    }
  }

  function regressPhase() {
    const idx = PHASE_ORDER.indexOf(phase);
    if (idx > 0) {
      const prev = PHASE_ORDER[idx - 1];
      setPhase(prev);
      log(`Fase: ${PHASE_CONFIG[prev].emoji} ${PHASE_CONFIG[prev].label}`);
    }
  }

  // ─── Dedup debounce ───────────────────────────────────────────────────

  useEffect(() => {
    if (!captureType || !captureText.trim()) {
      setDedupSuggestions([]);
      return;
    }
    const timer = setTimeout(() => searchDedup(captureText.trim()), 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureText, captureType]);

  // ─── Initial load ─────────────────────────────────────────────────────

  useEffect(() => {
    loadInbox();
    loadGhIssues();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────

  const openCount = ghIssues.filter((i) => !i.pull_request).length;
  const sev = focus ? getSeverity(focus.labels) : '';
  const effort = focus ? getEffortScore(focus.labels) : 2;
  const effortTxt = effort === 1 ? 'Baixo' : effort === 2 ? 'Medio' : 'Alto';

  const stats = PRIORITY.map((p) => ({
    label: p.toUpperCase(),
    count: ghIssues.filter((i) => !i.pull_request && getSeverity(labelsOf(i)) === p).length,
    color: sevColor(p),
  }));

  // Phase progress
  const phaseIdx = PHASE_ORDER.indexOf(phase);
  const LOCAL_PHASES = 4; // ready, awaiting-tests, testing, local-ok
  const isLocalPhase = phaseIdx < LOCAL_PHASES;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5">
      {/* Local Mode Banner */}
      <div className="rounded-xl border-2 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 flex items-center gap-3">
        <span className="text-xl">&#9888;&#65039;</span>
        <div>
          <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
            Modo Local — Vercel desativado
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Testes rodam contra localhost. Deploy via CI local no GitHub.
          </p>
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Rocket className="h-6 w-6 text-purple-500" />
            Roda V3 (Local First)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Execucao local completa — sem depender do Vercel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.open(PROJECT_URL, '_blank')}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5 inline mr-1" />
            Project
          </button>
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
            openCount > 0
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}>
            {openCount} issues
          </span>
        </div>
      </div>

      {/* Phase Progress Bar */}
      {focus && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {phaseLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin text-slate-400" />
              ) : (
                <span className="text-lg">{PHASE_CONFIG[phase].emoji}</span>
              )}
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${PHASE_CONFIG[phase].color}`}>
                {PHASE_CONFIG[phase].label}
              </span>
              <span className="text-xs text-slate-400">
                #{focus.number}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={regressPhase}
                disabled={phaseIdx === 0}
                className="rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-500 text-xs px-2 py-1"
              >
                &#8592;
              </button>
              <button
                onClick={advancePhase}
                disabled={phaseIdx >= PHASE_ORDER.length - 1}
                className="rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-500 text-xs px-2 py-1"
              >
                &#8594;
              </button>
            </div>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-0.5">
            {PHASE_ORDER.map((p, i) => {
              const isCurrent = i === phaseIdx;
              const isPast = i < phaseIdx;
              const isBoundary = i === LOCAL_PHASES; // divider between local and GitHub

              return (
                <div key={p} className="flex items-center gap-0.5 flex-1">
                  {isBoundary && (
                    <div className="flex flex-col items-center mx-1">
                      <div className="w-px h-2 bg-slate-300 dark:bg-slate-700" />
                      <span className="text-[9px] text-slate-400 whitespace-nowrap">GitHub</span>
                      <div className="w-px h-2 bg-slate-300 dark:bg-slate-700" />
                    </div>
                  )}
                  <div
                    className={`h-2 flex-1 rounded-full transition-colors ${
                      isPast
                        ? 'bg-green-500'
                        : isCurrent
                        ? isLocalPhase ? 'bg-purple-500' : 'bg-indigo-500'
                        : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                    title={PHASE_CONFIG[p].label}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400">
            <span>Local</span>
            <span>GitHub</span>
          </div>
        </div>
      )}

      {/* Severity stats */}
      {openCount > 0 && (
        <div className="flex gap-2 flex-wrap">
          {stats.filter((s) => s.count > 0).map((s) => (
            <span key={s.label} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.color}`}>
              {s.label}: {s.count}
            </span>
          ))}
        </div>
      )}

      {/* Audit prompt when no issues */}
      {openCount === 0 && !ghLoading && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">
            Sem issues abertas. Projeto aparentemente estavel.
          </p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(generateAuditPrompt());
                log('Prompt de auditoria copiado');
              } catch {
                log('ERRO: falha ao copiar.');
              }
            }}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 transition-colors"
          >
            Gerar Prompt Nova Auditoria
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => { setCaptureType('idea'); setCaptureText(''); }}
          className="flex items-center gap-2 justify-center rounded-xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-sm font-bold px-4 py-3 transition-colors"
        >
          <Lightbulb className="h-4 w-4" />
          Captura (Ideia)
        </button>
        <button
          onClick={() => { setCaptureType('error'); setCaptureText(''); }}
          className="flex items-center gap-2 justify-center rounded-xl border-2 border-dashed border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 text-red-700 dark:text-red-300 text-sm font-bold px-4 py-3 transition-colors"
        >
          <AlertTriangle className="h-4 w-4" />
          Captura (Erro)
        </button>
        <button
          onClick={pullNext}
          disabled={ghIssues.length === 0}
          className="flex items-center gap-2 justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-bold px-4 py-3 transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          Proxima Issue
        </button>
        <button
          onClick={copySmartPrompt}
          disabled={!focus && openCount > 0}
          className="flex items-center gap-2 justify-center rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white text-sm font-bold px-4 py-3 transition-colors"
        >
          <Copy className="h-4 w-4" />
          Copiar Prompt
        </button>
      </div>

      {/* Capture mini-form */}
      {captureType && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-3">
          <div className="flex items-center gap-2">
            {captureType === 'idea' ? (
              <Lightbulb className="h-4 w-4 text-indigo-500" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-500" />
            )}
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {captureType === 'idea' ? 'Nova Ideia' : 'Novo Erro'}
            </span>
          </div>
          <textarea
            autoFocus
            placeholder={captureType === 'idea' ? 'Descreva a ideia...' : 'Descreva o erro (cole logs se tiver)...'}
            value={captureText}
            onChange={(e) => setCaptureText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {dedupLoading && (
            <p className="text-[11px] text-slate-400">Buscando duplicatas...</p>
          )}
          {dedupSuggestions.length > 0 && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
              <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300 mb-1.5">
                <Link2 className="h-3 w-3 inline mr-1" />
                Issues similares encontradas:
              </p>
              <div className="space-y-1">
                {dedupSuggestions.map((s) => (
                  <a key={s.number} href={s.html_url} target="_blank" rel="noreferrer" className="block text-xs text-amber-600 dark:text-amber-400 hover:underline">
                    #{s.number} — {s.title}
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => captureText.trim() && createInboxItem(captureType, captureText.trim())}
              disabled={!captureText.trim()}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold px-4 py-2 transition-colors"
            >
              Salvar
            </button>
            <button
              onClick={() => { setCaptureType(null); setDedupSuggestions([]); }}
              className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-4 py-2 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbox">
            Inbox
            {inboxItems.filter((i) => i.status === 'new').length > 0 && (
              <span className="ml-1.5 text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                {inboxItems.filter((i) => i.status === 'new').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="launch-gate">Launch Gate</TabsTrigger>
          <TabsTrigger value="focus">
            Focus
            {focus && (
              <span className="ml-1.5 text-[10px] font-bold bg-indigo-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                #{focus.number}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── INBOX TAB ─────────────────────────────────────────────── */}
        <TabsContent value="inbox" className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={inboxFilter.search || ''}
                onChange={(e) => {
                  const f = { ...inboxFilter, search: e.target.value || undefined };
                  setInboxFilter(f);
                  loadInbox(f);
                }}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={inboxFilter.status || ''}
              onChange={(e) => {
                const f = { ...inboxFilter, status: e.target.value || undefined };
                setInboxFilter(f);
                loadInbox(f);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Todos status</option>
              <option value="new">New</option>
              <option value="triaged">Triaged</option>
              <option value="converted">Converted</option>
            </select>
            <select
              value={inboxFilter.type || ''}
              onChange={(e) => {
                const f = { ...inboxFilter, type: e.target.value || undefined };
                setInboxFilter(f);
                loadInbox(f);
              }}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
            >
              <option value="">Todos tipos</option>
              <option value="idea">Ideia</option>
              <option value="error">Erro</option>
            </select>
            <button
              onClick={() => loadInbox()}
              disabled={inboxLoading}
              className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold px-3 py-2 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${inboxLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {inboxItems.length === 0 ? (
            <div className="text-center py-12 text-sm text-slate-400">
              {inboxLoading ? 'Carregando...' : 'Inbox vazio. Use os botoes de captura rapida.'}
            </div>
          ) : (
            <div className="space-y-2">
              {inboxItems.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-full p-1.5 ${
                      item.type === 'idea'
                        ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                        : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                    }`}>
                      {item.type === 'idea' ? <Lightbulb className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.title}</span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.status === 'new'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : item.status === 'triaged'
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {item.status.toUpperCase()}
                        </span>
                        {item.severity && (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${sevColor(item.severity)}`}>
                            {item.severity.toUpperCase()}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">{timeAgo(item.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {item.status === 'new' && (
                          <button onClick={() => triageItem(item)} className="rounded-md bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold px-2.5 py-1 transition-colors">
                            Triar
                          </button>
                        )}
                        {item.status === 'triaged' && (
                          <button onClick={() => convertToIssue(item)} className="rounded-md bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2.5 py-1 transition-colors">
                            <Plus className="h-3 w-3 inline mr-1" />
                            Criar Issue
                          </button>
                        )}
                        {item.github_issue_url && (
                          <a href={item.github_issue_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold px-2.5 py-1 hover:underline">
                            <ExternalLink className="h-3 w-3" />
                            #{item.github_issue_number}
                          </a>
                        )}
                        <button
                          onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                          className="rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs px-2.5 py-1 transition-colors"
                        >
                          {expandedItem === item.id ? <ChevronUp className="h-3 w-3 inline" /> : <ChevronDown className="h-3 w-3 inline" />}
                          <span className="ml-1">Detalhes</span>
                        </button>
                      </div>
                      {expandedItem === item.id && (
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                          <div>
                            <label className="block text-[11px] text-slate-400 mb-1">Texto original</label>
                            <p className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 rounded-lg p-2 whitespace-pre-wrap">{item.raw_text}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Severidade</label>
                              <select
                                value={item.severity || ''}
                                onChange={(e) => updateInboxItem(item.id, { severity: e.target.value || null } as Partial<InboxItem>)}
                                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-slate-100"
                              >
                                <option value="">(nenhuma)</option>
                                {PRIORITY.map((p) => <option key={p} value={p}>{p}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Area(s)</label>
                              <input
                                type="text"
                                value={item.area.join(', ')}
                                onChange={(e) => updateInboxItem(item.id, { area: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                                placeholder="api, bot, ui..."
                                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
                              />
                            </div>
                          </div>
                          {item.needs_info.length > 0 && (
                            <div>
                              <label className="block text-[11px] text-slate-400 mb-1">Info faltando</label>
                              <div className="flex gap-1 flex-wrap">
                                {item.needs_info.map((info) => (
                                  <span key={info} className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-[10px] font-bold">{info}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── LAUNCH GATE TAB ───────────────────────────────────────── */}
        <TabsContent value="launch-gate" className="space-y-4">
          {ghError && (
            <div className="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-red-600" />
                <span className="text-sm font-bold text-red-700 dark:text-red-300">GitHub Error</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400">{ghError}</p>
              <p className="text-[10px] text-red-500 mt-1">needs-info: configure GH_PAT_ADMIN no env</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-300">
                Issues Abertas ({ghIssues.filter((i) => !i.pull_request).length})
              </h3>
              <button
                onClick={loadGhIssues}
                disabled={ghLoading}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-1.5 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 inline mr-1 ${ghLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {ghIssues.filter((i) => !i.pull_request).length === 0 ? (
              <div className="text-center py-8 text-sm text-slate-400">
                {ghLoading ? 'Carregando...' : 'Nenhuma issue aberta.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {ghIssues
                  .filter((i) => !i.pull_request)
                  .sort((a, b) => severityScore(getSeverity(labelsOf(a))) - severityScore(getSeverity(labelsOf(b))))
                  .map((issue) => {
                    const issueSev = getSeverity(labelsOf(issue));
                    return (
                      <div key={issue.number} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <span className="text-xs font-mono text-slate-400 w-8">#{issue.number}</span>
                        <span className="text-sm text-slate-900 dark:text-white flex-1 truncate">{issue.title}</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${sevColor(issueSev)}`}>
                            {issueSev}
                          </span>
                          {issue.labels
                            .filter((l) => !PRIORITY.includes(l.name as (typeof PRIORITY)[number]))
                            .slice(0, 3)
                            .map((l) => (
                              <span key={l.name} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${labelBadgeColor(l.color)}`}>
                                {l.name}
                              </span>
                            ))}
                        </div>
                        <a href={issue.html_url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                          onClick={() => focusIssue(issue)}
                          className="rounded-md bg-indigo-100 dark:bg-indigo-900/30 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold px-2.5 py-1 transition-colors"
                        >
                          Focar
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ─── FOCUS TAB ─────────────────────────────────────────────── */}
        <TabsContent value="focus" className="space-y-4">
          {!focus ? (
            <div className="text-center py-12 text-sm text-slate-400">
              Nenhuma issue em foco. Selecione uma na aba Launch Gate ou clique &ldquo;Proxima Issue&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Main focus card */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 space-y-4">
                  <div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      #{focus.number} — {focus.title}
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${sevColor(sev)}`}>
                        {sev.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">
                        Esforco: {effortTxt}
                      </span>
                      {focus.labels
                        .filter((l) => !PRIORITY.includes(l as (typeof PRIORITY)[number]))
                        .map((l) => (
                          <span key={l} className="inline-flex items-center rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 text-[10px] font-bold">
                            {l}
                          </span>
                        ))}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={copySmartPrompt}
                      className="flex-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold px-4 py-3 text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar Prompt ({PHASE_CONFIG[phase].label})
                    </button>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={copyBranch}
                      className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 transition-colors flex items-center gap-1.5"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      Copiar branch
                    </button>
                    <a
                      href={focus.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 transition-colors flex items-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir issue
                    </a>
                    <button
                      onClick={() => { setFocus(null); setPhase('ready'); log('Foco removido'); }}
                      className="rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold px-3 py-2 transition-colors"
                    >
                      Reset foco
                    </button>
                  </div>
                </div>
              </div>

              {/* Sidebar — Rules + Log */}
              <div className="space-y-4">
                {/* Anti-false-close rules */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-2">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    Regras Anti-Falso-Fechamento
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      Testes locais verdes (unit + e2e)
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      CI local verde no GitHub
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      PR mergeado via auto-merge
                    </li>
                    <li className="flex items-start gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                      Issue fechada via Closes #X
                    </li>
                  </ul>
                </div>

                {/* Activity log */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                    Log de Atividade
                  </h4>
                  <div
                    ref={logRef}
                    className="max-h-48 overflow-y-auto space-y-1 font-mono"
                  >
                    {logs.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">Sem atividade registrada.</p>
                    ) : (
                      logs.map((entry, i) => (
                        <p key={i} className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
                          {entry}
                        </p>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Bottom log (when not in focus tab) */}
      {activeTab !== 'focus' && logs.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
          <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
            Log de Atividade
          </h4>
          <div className="max-h-32 overflow-y-auto space-y-1 font-mono">
            {logs.slice(0, 10).map((entry, i) => (
              <p key={i} className="text-[11px] text-slate-500 dark:text-slate-400 break-all">
                {entry}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
