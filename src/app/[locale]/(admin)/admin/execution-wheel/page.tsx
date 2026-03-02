'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

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
}

interface Focus {
  number: number;
  title: string;
  url: string;
  labels: string[];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const REPO = 'Gabiribpin/circlehood-booking';
const PROJECT_URL = 'https://github.com/users/Gabiribpin/projects/7';
const PRIORITY = ['blocker', 'critical', 'high', 'medium', 'low', 'enhancement'] as const;
const LS_TOKEN = 'wheel.token';
const LS_CHECKPOINT = 'wheel.checkpoint';
const ENV_TOKEN = process.env.NEXT_PUBLIC_GH_ISSUES_PAT || '';

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

function sevColor(sev: string): string {
  if (sev === 'blocker') return 'bg-red-600 text-white';
  if (sev === 'critical') return 'bg-amber-500 text-black';
  if (sev === 'high') return 'bg-orange-400 text-black';
  if (sev === 'medium') return 'bg-yellow-300 text-black';
  if (sev === 'low') return 'bg-sky-300 text-black';
  return 'bg-slate-500 text-white';
}

// ─── GitHub API ──────────────────────────────────────────────────────────────

async function ghFetch(path: string, token: string, opts: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res.status === 204 ? null : res.json();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ExecutionWheelPage() {
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [issues, setIssues] = useState<GHIssue[]>([]);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Capture form
  const [newType, setNewType] = useState('enhancement');
  const [newSev, setNewSev] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  const logRef = useRef<HTMLDivElement>(null);

  const log = useCallback((msg: string) => {
    const ts = new Date().toISOString().slice(11, 19);
    setLogs((prev) => [`[${ts}] ${msg}`, ...prev].slice(0, 100));
  }, []);

  // Load saved state + auto-connect if env token available
  useEffect(() => {
    const savedToken = localStorage.getItem(LS_TOKEN) || '';
    const initialToken = ENV_TOKEN || savedToken;
    setToken(initialToken);
    try {
      const cp = localStorage.getItem(LS_CHECKPOINT);
      if (cp) setFocus(JSON.parse(cp));
    } catch { /* ignore */ }

    // Auto-connect if we have a token
    if (initialToken) {
      (async () => {
        try {
          await ghFetch(`/repos/${REPO}`, initialToken);
          localStorage.setItem(LS_TOKEN, initialToken);
          setConnected(true);
          // refresh will be triggered by the connected effect below
        } catch { /* silent — user can connect manually */ }
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save checkpoint
  useEffect(() => {
    if (focus) localStorage.setItem(LS_CHECKPOINT, JSON.stringify(focus));
    else localStorage.removeItem(LS_CHECKPOINT);
  }, [focus]);

  // Auto-refresh when connected
  useEffect(() => {
    if (connected && token) {
      refresh(token, focus);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const saveFocus = useCallback((f: Focus | null) => {
    setFocus(f);
  }, []);

  const refresh = useCallback(async (tok: string, currentFocus: Focus | null) => {
    setLoading(true);
    try {
      const data: GHIssue[] = await ghFetch(`/repos/${REPO}/issues?state=open&per_page=100`, tok);
      const filtered = data.filter((i) => !i.pull_request);
      setIssues(filtered);

      if (!currentFocus) {
        const next = pickNext(filtered);
        if (next) {
          const f: Focus = { number: next.number, title: next.title, url: next.html_url, labels: labelsOf(next) };
          saveFocus(f);
          log(`Auto-selecionada: #${next.number} (${getSeverity(f.labels).toUpperCase()})`);
        } else {
          log('Nenhuma issue aberta encontrada.');
        }
      } else {
        const current = filtered.find((i) => i.number === currentFocus.number);
        if (current) {
          const f: Focus = { number: current.number, title: current.title, url: current.html_url, labels: labelsOf(current) };
          saveFocus(f);
          log(`Foco atualizado: #${current.number}`);
        } else {
          log('Issue do checkpoint foi fechada. Recalculando...');
          saveFocus(null);
          const next = pickNext(filtered);
          if (next) {
            const f: Focus = { number: next.number, title: next.title, url: next.html_url, labels: labelsOf(next) };
            saveFocus(f);
            log(`Novo foco: #${next.number}`);
          }
        }
      }
    } catch (e) {
      log(`ERRO: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [log, saveFocus]);

  async function handleConnect() {
    if (!token.trim()) return;
    localStorage.setItem(LS_TOKEN, token);
    setLoading(true);
    try {
      await ghFetch(`/repos/${REPO}`, token);
      setConnected(true);
      log('Conectado ao GitHub.');
      await refresh(token, focus);
    } catch (e) {
      log(`ERRO: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommentProgress() {
    if (!focus) return;
    const text = prompt('Comentário de progresso (curto e técnico):');
    if (!text) return;
    try {
      await ghFetch(`/repos/${REPO}/issues/${focus.number}/comments`, token, {
        method: 'POST',
        body: JSON.stringify({ body: `✅ Progresso\n\n${text}\n\n— Roda de Execução` }),
      });
      log(`Comentário postado na #${focus.number}`);
    } catch (e) {
      log(`ERRO: ${(e as Error).message}`);
    }
  }

  async function handleCloseIssue() {
    if (!focus) return;
    if (!confirm(`Fechar #${focus.number}? (só se DONE: build verde + comentário técnico)`)) return;
    try {
      await ghFetch(`/repos/${REPO}/issues/${focus.number}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ state: 'closed' }),
      });
      log(`#${focus.number} fechada.`);
      saveFocus(null);
      await refresh(token, null);
    } catch (e) {
      log(`ERRO: ${(e as Error).message}`);
    }
  }

  async function handleCreateIssue() {
    if (!newTitle.trim()) return;
    const labels = [newType];
    if (newSev) labels.push(newSev);
    try {
      const created = await ghFetch(`/repos/${REPO}/issues`, token, {
        method: 'POST',
        body: JSON.stringify({ title: newTitle, body: newBody || '', labels }),
      });
      log(`Issue criada: #${created.number} (${labels.join(', ')})`);
      setNewTitle('');
      setNewBody('');
      setNewSev('');
      await refresh(token, focus);
    } catch (e) {
      log(`ERRO: ${(e as Error).message}`);
    }
  }

  function handleCopyBranch() {
    if (!focus) return;
    navigator.clipboard.writeText(branchName(focus)).then(() => log(`Branch copiada: ${branchName(focus)}`));
  }

  async function handleCopyPrompt() {
    if (!focus) { alert('Nenhuma issue em foco.'); return; }

    let body = '(não foi possível carregar o corpo da issue)';
    try {
      const issue = await ghFetch(`/repos/${REPO}/issues/${focus.number}`, token);
      if (issue?.body) body = issue.body;
    } catch { /* use fallback body */ }

    const prompt = [
      'MODO EXECUÇÃO CONTROLADA — Issue #' + focus.number,
      'Título: ' + focus.title,
      'Link: ' + focus.url,
      'Labels: ' + (focus.labels.join(', ') || '(nenhuma)'),
      '',
      'Regras:',
      '- Trabalhar somente nesta issue.',
      '- Não alterar escopo.',
      '- Não concluir sem teste + build verde.',
      '- Sempre em branch separada.',
      '',
      'Contexto da issue:',
      body,
      '',
      'Tarefas:',
      '1) Diagnóstico técnico',
      '2) Causa raiz',
      '3) Correção mínima e segura',
      '4) Testes obrigatórios',
      '5) Evidência (diff + build + testes)',
      '6) Criar branch: ' + branchName(focus),
      '7) Commit:',
      '   fix(scope): descrição objetiva',
      '',
      '   Closes #' + focus.number,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(prompt);
      log(`Prompt Claude copiado — Issue #${focus.number}`);
    } catch {
      log('ERRO: falha ao copiar para clipboard.');
    }
  }

  const openCount = issues.filter((i) => !i.pull_request).length;
  const sev = focus ? getSeverity(focus.labels) : '';
  const effort = focus ? getEffortScore(focus.labels) : 2;
  const effortTxt = effort === 1 ? 'Baixo' : effort === 2 ? 'Médio' : 'Alto';

  // Severity stats
  const stats = PRIORITY.map((p) => ({
    label: p.toUpperCase(),
    count: issues.filter((i) => !i.pull_request && getSeverity(labelsOf(i)) === p).length,
    color: sevColor(p),
  }));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Roda de Execucao</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Auto-gerenciada — uma issue por vez, sem desviar
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${
            connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
          }`}
        >
          {connected ? `Conectado — ${openCount} issues` : 'Desconectado'}
        </span>
      </div>

      {/* Connect bar */}
      {!connected && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 space-y-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Cole um <b>Fine-grained PAT</b> com <b>Issues: Read/Write</b> no repo {REPO}.
          </p>
          <div className="flex gap-3">
            <input
              type="password"
              placeholder="github_pat_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleConnect}
              disabled={loading || !token.trim()}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold px-5 py-2 transition-colors"
            >
              {loading ? 'Conectando...' : 'Conectar'}
            </button>
          </div>
        </div>
      )}

      {/* Severity stats */}
      {connected && (
        <div className="flex gap-2 flex-wrap">
          {stats.map((s) => (
            <span key={s.label} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.color}`}>
              {s.label}: {s.count}
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* FOCUS */}
        <div className="lg:col-span-2 space-y-5">
          {/* Current issue */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Agora
            </h2>

            {!focus ? (
              <p className="text-sm text-slate-400 dark:text-slate-500 italic">
                {connected ? 'Nenhuma issue em foco. Clique Atualizar.' : 'Conecte para começar.'}
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    #{focus.number} — {focus.title}
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sevColor(sev)}`}>
                      {sev.toUpperCase()}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 text-[11px] font-bold">
                      Esforco: {effortTxt}
                    </span>
                    {focus.labels.filter((l) => !PRIORITY.includes(l as (typeof PRIORITY)[number])).map((l) => (
                      <span key={l} className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 text-[10px]">
                        {l}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <div>
                    <span className="text-slate-400">Branch:</span>{' '}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px]">
                      {branchName(focus)}
                    </code>
                  </div>
                  <div>
                    <span className="text-slate-400">Link:</span>{' '}
                    <a href={focus.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                      {focus.url}
                    </a>
                  </div>
                </div>

                <div className="border-t border-slate-200 dark:border-slate-800 pt-3">
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                    Protocolo: planejar (10 linhas) → implementar → build verde → comentar progresso → fechar
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap pt-1">
              <button
                onClick={() => refresh(token, focus)}
                disabled={!connected || loading}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 transition-colors"
              >
                {loading ? 'Carregando...' : 'Atualizar'}
              </button>
              <button
                onClick={handleCopyBranch}
                disabled={!focus}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 transition-colors"
              >
                Copiar branch
              </button>
              <button
                onClick={() => focus && window.open(focus.url, '_blank')}
                disabled={!focus}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 transition-colors"
              >
                Abrir issue
              </button>
              <button
                onClick={() => window.open(PROJECT_URL, '_blank')}
                disabled={!connected}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-700 dark:text-slate-200 text-xs font-bold px-3 py-2 transition-colors"
              >
                Abrir project
              </button>
              <button
                onClick={handleCopyPrompt}
                disabled={!focus}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold px-3 py-2 transition-colors"
              >
                Copiar prompt (Claude)
              </button>
              <button
                onClick={handleCommentProgress}
                disabled={!focus}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold px-3 py-2 transition-colors"
              >
                Comentar progresso
              </button>
              <button
                onClick={handleCloseIssue}
                disabled={!focus}
                className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold px-3 py-2 transition-colors"
              >
                Fechar issue
              </button>
              <button
                onClick={() => { saveFocus(null); log('Checkpoint resetado.'); }}
                disabled={!focus}
                className="rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-500 dark:text-slate-400 text-xs font-bold px-3 py-2 transition-colors"
              >
                Reset foco
              </button>
            </div>
          </div>

          {/* Capture idea/bug */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Capturar ideia/bug (sem quebrar foco)
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Tipo</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="enhancement">Ideia (enhancement)</option>
                  <option value="bug">Bug</option>
                  <option value="security">Seguranca</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Severidade</label>
                <select
                  value={newSev}
                  onChange={(e) => setNewSev(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">(nenhuma)</option>
                  <option value="blocker">blocker</option>
                  <option value="critical">critical</option>
                  <option value="high">high</option>
                  <option value="medium">medium</option>
                  <option value="low">low</option>
                </select>
              </div>
            </div>

            <input
              type="text"
              placeholder="Titulo"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />

            <textarea
              placeholder="Descricao (curta e objetiva)"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 resize-none"
            />

            <button
              onClick={handleCreateIssue}
              disabled={!connected || !newTitle.trim()}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-bold px-4 py-2 transition-colors"
            >
              Criar issue e voltar ao foco
            </button>
          </div>
        </div>

        {/* SIDEBAR: Rules + Log */}
        <div className="space-y-5">
          {/* Rules */}
          <div className="rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-2">
              Regras
            </p>
            <div className="font-mono text-[11px] leading-relaxed text-slate-700 dark:text-slate-300 space-y-1">
              <p>1) Uma issue por vez.</p>
              <p>2) Nunca refatorar antes de zerar BLOCKER.</p>
              <p>3) Ideia nova = issue + volta ao foco.</p>
              <p>4) Done so com comentario tecnico.</p>
              <p>5) Nunca fechar sem PR + CI verde.</p>
            </div>
          </div>

          {/* Log */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 mb-2">
              Log
            </h2>
            <div
              ref={logRef}
              className="font-mono text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded-lg p-3 h-64 overflow-y-auto"
            >
              {logs.length === 0 ? (
                <span className="italic">Conecte para começar.</span>
              ) : (
                logs.map((l, i) => <div key={i}>{l}</div>)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
