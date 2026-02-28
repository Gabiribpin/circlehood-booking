import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const troubleshootingData = [
  {
    problem: '🚨 Sistema totalmente fora do ar',
    severity: 'critical',
    steps: [
      'Calma! Respira 3x',
      'Vercel Dashboard → Runtime Logs',
      'Vê o erro',
      'Se não entender: Cola erro no Claude',
      'Rollback: git revert HEAD + git push --force',
      'Avisa clientes: "Manutenção emergencial, volta em 1h"',
      'Resolve com calma',
      'Testa local',
      'Deploy quando OK',
      'Avisa clientes: "Resolvido! Desculpa!"',
    ],
    links: [
      { label: 'Vercel Logs', url: 'https://vercel.com/circlehoodtech-projects/circlehood-booking/logs' },
    ],
  },
  {
    problem: '💳 Pagamento Stripe não funciona',
    severity: 'high',
    steps: [
      'Vercel env vars → STRIPE_SECRET_KEY presente?',
      'Stripe Dashboard → API keys corretas?',
      'Webhook configurado? (Settings → Webhooks)',
      'Logs Stripe → qual erro?',
      'Teste local: cartão 4242 4242 4242 4242',
      'Se funciona local mas não prod → env vars!',
      'Claude Code pode ajudar!',
    ],
    links: [
      { label: 'Stripe Dashboard', url: 'https://dashboard.stripe.com' },
    ],
  },
  {
    problem: '📧 Emails não chegam',
    severity: 'medium',
    steps: [
      'Resend Dashboard → Logs',
      'Email foi enviado? (status)',
      'Caixa de spam do cliente?',
      'Domínio verificado no Resend?',
      'Rate limit atingido? (quota diária 100 emails)',
      'Workaround: Envia manualmente via admin',
    ],
    links: [
      { label: 'Resend Dashboard', url: 'https://resend.com/emails' },
    ],
  },
  {
    problem: '🤖 Bot WhatsApp não responde',
    severity: 'high',
    steps: [
      'Evolution API → instância ativa?',
      'Webhook configurado correto?',
      'Vercel logs → webhook recebendo mensagens?',
      'ANTHROPIC_API_KEY configurada no Vercel?',
      'Supabase → whatsapp_config tem credenciais?',
      'Teste: Manda mensagem e vê logs em tempo real',
    ],
    links: [],
  },
  {
    problem: '🔐 Acesso negado / autenticação falha',
    severity: 'medium',
    steps: [
      'Supabase Dashboard → Auth → Users',
      'Email confirmado? (email_confirmed_at preenchido?)',
      'Conta do profissional existe? (tabela professionals)',
      'Limpar cookies do browser e tentar de novo',
      'Reset de senha via painel Supabase Auth',
    ],
    links: [
      { label: 'Supabase Auth', url: 'https://supabase.com/dashboard/project/ibkkxykcrwhncvqxzynt/auth/users' },
    ],
  },
  {
    problem: '😰 Tô perdida, não sei o que fazer',
    severity: 'low',
    steps: [
      'PARE. Respira. Toma água.',
      'Abre Claude Code e desabafa',
      'Lista o que tá pegando',
      'A gente resolve JUNTO',
      'Você NÃO está sozinha! 💜',
    ],
    links: [],
  },
];

const SEVERITY_STYLE: Record<string, { border: string; badge: string; label: string }> = {
  critical: { border: 'border-l-red-500',    badge: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',    label: '🔴 Crítico' },
  high:     { border: 'border-l-orange-500', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400', label: '🟠 Alto' },
  medium:   { border: 'border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400', label: '🟡 Médio' },
  low:      { border: 'border-l-green-500',  badge: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',   label: '🟢 Baixo' },
};

export default function HandbookTroubleshootingPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
      <Link
        href="/admin/handbook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Handbook
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">🛠️ Troubleshooting</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Guia passo-a-passo para resolver problemas comuns — sem entrar em pânico
        </p>
      </div>

      <div className="space-y-4">
        {troubleshootingData.map((item) => {
          const style = SEVERITY_STYLE[item.severity];
          return (
            <Card key={item.problem} className={`border-l-4 ${style.border}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{item.problem}</CardTitle>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="space-y-2">
                  {item.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="font-bold text-muted-foreground shrink-0 w-5 text-right">
                        {i + 1}.
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>

                {item.links.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t">
                    {item.links.map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        🔗 {link.label}
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
