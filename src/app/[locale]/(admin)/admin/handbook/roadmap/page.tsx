import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const roadmapData = [
  {
    phase: 'Fase 1: Lançamento',
    subtitle: 'AGORA',
    status: 'em andamento',
    color: 'border-l-red-500',
    badgeVariant: 'destructive' as const,
    estimatedDate: 'Fev 2026',
    items: [
      { done: true,  text: 'Sistema funcionando' },
      { done: true,  text: 'Stripe configurado' },
      { done: true,  text: 'Marketing posts prontos' },
      { done: true,  text: 'i18n completo (PT-BR, EN-US, ES-ES)' },
      { done: true,  text: 'Depoimentos públicos com aprovação' },
      { done: true,  text: 'Bot de vendas WhatsApp (Evolution API)' },
      { done: false, text: 'Teste pagamento completo',  priority: '🔴' },
      { done: false, text: 'Deploy production',         priority: '🔴' },
      { done: false, text: 'Post Instagram lançamento', priority: '🔴' },
    ],
  },
  {
    phase: 'Fase 2: Primeiros Clientes',
    subtitle: 'Semana 1-2',
    status: 'próximo',
    color: 'border-l-orange-500',
    badgeVariant: 'secondary' as const,
    estimatedDate: 'Mar 2026',
    items: [
      { done: false, text: 'Comprar chip WhatsApp oficial',        priority: '🟠' },
      { done: false, text: 'Configurar bot vendas Evolution',      priority: '🟠' },
      { done: false, text: '5-10 trials iniciados',               priority: '🟡' },
      { done: false, text: 'Primeiros 3 clientes pagos',          priority: '🟡' },
      { done: false, text: 'Sistema tracking bugs (planilha)',     priority: '🟡' },
    ],
  },
  {
    phase: 'Fase 3: Consolidação',
    subtitle: 'Mês 1',
    status: 'futuro',
    color: 'border-l-blue-400',
    badgeVariant: 'outline' as const,
    estimatedDate: 'Abr 2026',
    items: [
      { done: false, text: '15-20 clientes ativos' },
      { done: false, text: '€300-400/mês receita' },
      { done: false, text: 'Ambiente staging' },
      { done: true,  text: 'Testes E2E completos (22 jobs CI)' },
      { done: false, text: 'Changelog automático' },
    ],
  },
  {
    phase: 'Fase 4: Escala',
    subtitle: 'Mês 2-3',
    status: 'futuro',
    color: 'border-l-purple-400',
    badgeVariant: 'outline' as const,
    estimatedDate: 'Mai-Jun 2026',
    items: [
      { done: false, text: '30-40 clientes' },
      { done: false, text: '€600-800/mês' },
      { done: true,  text: 'CI/CD completo (branch protection + 13 checks)' },
      { done: false, text: 'Monitoring + alertas' },
      { done: false, text: 'Reduzir HDI part-time?' },
    ],
  },
  {
    phase: 'Fase 5: Independência 🎉',
    subtitle: 'Mês 4-6',
    status: 'sonho',
    color: 'border-l-green-500',
    badgeVariant: 'outline' as const,
    estimatedDate: 'Jul-Ago 2026',
    items: [
      { done: false, text: '50+ clientes' },
      { done: false, text: '€1,200+/mês' },
      { done: false, text: 'SAIR DA HDI! 🎉' },
      { done: false, text: 'Contratar ajuda?' },
      { done: false, text: 'Viver! Ser mãe presente! 💜' },
    ],
  },
];

const STATUS_LABEL: Record<string, string> = {
  'em andamento': '🔄 Em andamento',
  próximo:        '⏳ Próximo',
  futuro:         '📅 Futuro',
  sonho:          '✨ Sonho',
};

export default function HandbookRoadmapPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-3xl">
      <Link
        href="/admin/handbook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Handbook
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">🗺️ Roadmap CircleHood</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Seu caminho para a independência financeira — passo a passo
        </p>
      </div>

      {/* Progress geral */}
      {(() => {
        const all = roadmapData.flatMap((p) => p.items);
        const done = all.filter((i) => i.done).length;
        const pct = Math.round((done / all.length) * 100);
        return (
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border-indigo-200 dark:border-indigo-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Progresso geral</span>
                <span className="text-sm font-bold text-indigo-600">{done}/{all.length} itens</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div
                  className="bg-indigo-500 h-3 rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-right">{pct}% concluído</p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Fases */}
      <div className="space-y-4">
        {roadmapData.map((phase) => {
          const done = phase.items.filter((i) => i.done).length;
          const pct = Math.round((done / phase.items.length) * 100);

          return (
            <Card key={phase.phase} className={`border-l-4 ${phase.color}`}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
                  <div>
                    <h2 className="font-bold text-base">{phase.phase}</h2>
                    <p className="text-xs text-muted-foreground">{phase.subtitle} · {phase.estimatedDate}</p>
                  </div>
                  <Badge variant={phase.badgeVariant} className="text-xs">
                    {STATUS_LABEL[phase.status]}
                  </Badge>
                </div>

                {/* Mini barra de progresso */}
                <div className="w-full bg-muted rounded-full h-1.5 mb-4">
                  <div
                    className="bg-primary h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <ul className="space-y-2">
                  {phase.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm">
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={item.done ? 'line-through text-muted-foreground' : ''}>
                        {item.text}
                      </span>
                      {'priority' in item && item.priority && (
                        <span className="ml-1">{item.priority}</span>
                      )}
                    </li>
                  ))}
                </ul>

                <p className="text-xs text-muted-foreground mt-3 text-right">
                  {done}/{phase.items.length} concluídos
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Motivação */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200">
        <CardContent className="p-5 text-center">
          <p className="text-2xl mb-2">💜</p>
          <p className="font-medium text-green-800 dark:text-green-300">
            Cada item concluído é um passo para a liberdade.
          </p>
          <p className="text-sm text-green-700 dark:text-green-400 mt-1">
            Você consegue, Gabi. Um dia de cada vez.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
