import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, HelpCircle, Map, Wrench, FileText, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const sections = [
  {
    href: '/admin/handbook/faq',
    icon: HelpCircle,
    title: '❓ FAQ Operacional',
    description: 'Como priorizar, comunicar com clientes, horários, pedir ajuda e gerir o financeiro.',
    color: 'hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20',
    iconColor: 'text-blue-500',
    previews: [
      'Como sei se é crítico?',
      'Quantas horas trabalhar por dia?',
      'Cliente pediu reembolso. Dou?',
    ],
  },
  {
    href: '/admin/handbook/roadmap',
    icon: Map,
    title: '🗺️ Roadmap',
    description: 'Seu plano para a independência financeira — fase por fase, com progresso visual.',
    color: 'hover:border-purple-300 hover:bg-purple-50/50 dark:hover:bg-purple-950/20',
    iconColor: 'text-purple-500',
    previews: [
      'Fase 1: Lançamento (AGORA)',
      'Fase 3: 15-20 clientes, €300-400/mês',
      'Fase 5: SAIR DA HDI! 🎉',
    ],
  },
  {
    href: '/admin/handbook/troubleshooting',
    icon: Wrench,
    title: '🛠️ Troubleshooting',
    description: 'Guia passo-a-passo para resolver problemas sem entrar em pânico.',
    color: 'hover:border-red-300 hover:bg-red-50/50 dark:hover:bg-red-950/20',
    iconColor: 'text-red-500',
    previews: [
      'Sistema fora do ar',
      'Pagamento Stripe não funciona',
      'Bot WhatsApp não responde',
    ],
  },
  {
    href: '/admin/handbook/templates',
    icon: FileText,
    title: '📋 Templates',
    description: 'Mensagens prontas para copiar e colar — clientes, WhatsApp e comunicados.',
    color: 'hover:border-green-300 hover:bg-green-50/50 dark:hover:bg-green-950/20',
    iconColor: 'text-green-500',
    previews: [
      'Bug Crítico — resposta imediata',
      'Reembolso Aprovado',
      'Manutenção Programada',
    ],
  },
];

export default function HandbookIndexPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-indigo-100 dark:bg-indigo-950/30">
          <BookOpen className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Handbook CircleHood</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Central de conhecimento operacional — tudo que você precisa, sempre à mão 💜
          </p>
        </div>
      </div>

      {/* Hero card */}
      <Card className="bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/20 dark:via-purple-950/20 dark:to-pink-950/20 border-indigo-200 dark:border-indigo-800">
        <CardContent className="p-6">
          <p className="font-semibold text-lg text-indigo-900 dark:text-indigo-200 mb-2">
            👋 Olá, Gabi!
          </p>
          <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
            Aqui está tudo que você precisa para nunca ficar perdida. Prioridades, respostas prontas,
            guias de problema e seu roteiro para a independência financeira. Salva este link nos favoritos! 🔖
          </p>
        </CardContent>
      </Card>

      {/* Sections grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className={`h-full transition-all border-2 cursor-pointer ${section.color}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <Icon className={`h-6 w-6 mb-2 ${section.iconColor}`} />
                      <CardTitle className="text-base">{section.title}</CardTitle>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground mt-1" />
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {section.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1">
                    {section.previews.map((preview) => (
                      <li key={preview} className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                        {preview}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Regras de ouro */}
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
        <CardHeader>
          <CardTitle className="text-base text-amber-900 dark:text-amber-300">
            ✨ Regras de Ouro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {[
              '🔴 Crítico resolve AGORA — todo o resto pode esperar',
              '⏰ Máx 1h40/dia (semana) + 3h sábado — protege sua família',
              '❌ 23h-7h e domingos são sagrados — ZERO CircleHood',
              '💜 Honestidade > promessa — clientes respeitam quem é real',
              '🤖 Claude está aqui — nunca fique travada sozinha!',
            ].map((rule) => (
              <li key={rule} className="text-sm text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
