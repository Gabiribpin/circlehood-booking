export default function ExecutionPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          EXECUCAO ATUAL
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Painel de estabilidade mental operacional — uso interno
        </p>
      </div>

      {/* Grid: 1 col mobile, 2 cols desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BLOCO 1 — Foco Ativo (azul) */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 p-5 flex flex-col">
          <h2 className="text-sm font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-3">
            FOCO ATIVO (So 1 coisa)
          </h2>
          <pre className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono flex-1">
{`id="9hmj6n"
🎯 ISSUE ATIVA
#3 — Double-booking pending_payment

Status: In Progress
Branch: fix/issue-3-pending-payment-conflict

Escopo:
Bloquear pending_payment como conflito no booking regular.

Criterios:
[ ] Retorna 409 quando slot tem pending_payment
[ ] Confirmed continua bloqueando
[ ] Cancelled continua liberando
[ ] Teste criado`}
          </pre>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-4 pt-3 border-t border-blue-200 dark:border-blue-800 italic">
            Regra mental: So existe UMA issue ativa. Ideia nova nao entra aqui.
          </p>
        </div>

        {/* BLOCO 2 — Ideias Estacionadas (amarelo) */}
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/40 p-5 flex flex-col">
          <h2 className="text-sm font-bold uppercase tracking-wide text-yellow-700 dark:text-yellow-300 mb-3">
            IDEIAS ESTACIONADAS
          </h2>
          <pre className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono flex-1">
{`id="2zn2tg"
🧠 IDEIAS (Nao tocar agora)

- Health dashboard de pagamentos
- Metricas de no-show
- Webhook retry queue`}
          </pre>
          <p className="text-[11px] text-yellow-700 dark:text-yellow-400 mt-4 pt-3 border-t border-yellow-200 dark:border-yellow-800 italic">
            Regra mental: Ideia nova vai aqui e voce volta para o foco.
          </p>
        </div>

        {/* BLOCO 3 — Check Pre-Execucao (roxo) */}
        <div className="rounded-xl border border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/40 p-5 flex flex-col">
          <h2 className="text-sm font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300 mb-3">
            CHECK PRE-EXECUCAO
          </h2>
          <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-mono flex-1 space-y-1.5">
            <p><span className="text-sm">id=&quot;tl19pw&quot;</span></p>
            <p>☑ Problema definido em 1 frase</p>
            <p>☑ Arquivo exato definido</p>
            <p>☑ O que NAO pode mexer definido</p>
            <p>☑ Teste obrigatorio definido</p>
            <p>☑ Issue nao sera fechada automaticamente</p>
          </div>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-4 pt-3 border-t border-purple-200 dark:border-purple-800 italic">
            Se um desses estiver vazio → nao execute.
          </p>
        </div>

        {/* BLOCO 4 — Estado do Sistema (vermelho) */}
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 p-5 flex flex-col">
          <h2 className="text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-300 mb-3">
            ESTADO DO SISTEMA
          </h2>
          <div className="text-xs leading-relaxed text-slate-800 dark:text-slate-200 font-mono flex-1 space-y-1.5">
            <p><span className="text-sm">id=&quot;0cgnus&quot;</span></p>
            <p>💰 Pagamentos: OK / Em revisao</p>
            <p>🤖 Bot: OK / Em revisao</p>
            <p>📧 Emails: OK / Em revisao</p>
            <p>🔐 Seguranca: OK / Em revisao</p>
            <p>🚀 Deploy: OK / Em revisao</p>
          </div>
          <p className="text-[11px] text-red-600 dark:text-red-400 mt-4 pt-3 border-t border-red-200 dark:border-red-800 italic">
            Visual para seu cerebro parar de imaginar incendios invisiveis.
          </p>
        </div>
      </div>
    </div>
  );
}
