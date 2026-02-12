import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  CalendarDays,
  Globe,
  MessageCircle,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Globe,
    title: 'Sua pagina profissional',
    description: 'Link personalizado tipo book.circlehood-tech.com/seu-nome. Coloque na bio do Instagram e pronto.',
  },
  {
    icon: CalendarDays,
    title: 'Agendamento online',
    description: 'Seus clientes escolhem o servico, dia e horario. Sem mensagens de ida e volta.',
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp integrado',
    description: 'Botao direto pro seu WhatsApp na pagina. Facil para os clientes falarem com voce.',
  },
  {
    icon: Sparkles,
    title: 'Bio gerada por IA',
    description: 'Nossa IA cria uma descricao profissional do seu negocio em segundos.',
  },
];

const BENEFITS = [
  'Pagina pronta em minutos',
  'Funciona no celular perfeitamente',
  'Receba agendamentos 24/7',
  'Sem necessidade de site proprio',
  'Suporte em portugues',
  'Teste gratis por 14 dias',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold">CircleHood Booking</span>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Comecar gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 sm:py-28 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            Sua pagina profissional com agendamento online
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Crie seu mini-site em minutos. Seus clientes veem seus servicos, precos e agendam direto — sem WhatsApp ping-pong.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="gap-2">
              <Link href="/register">
                Criar minha pagina gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/babycake">Ver exemplo</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            14 dias gratis. Sem cartao de credito.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Tudo que voce precisa num so lugar
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="p-6">
                  <feature.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8">
            Perfeito para profissionais autonomos
          </h2>
          <p className="text-muted-foreground mb-8">
            Cabeleireiras, nail techs, barbeiros, esteticistas, personal trainers, cleaners — se voce atende com horario marcado, o CircleHood e pra voce.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-md mx-auto">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                <span className="text-sm">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">
            Simples e acessivel
          </h2>
          <p className="text-center text-muted-foreground mb-10">
            Comece gratis, assine quando estiver pronto.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Free / Trial */}
            <Card>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Teste Gratis</h3>
                  <p className="text-sm text-muted-foreground">14 dias sem compromisso</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">&euro;0</span>
                  <span className="text-muted-foreground text-sm">/14 dias</span>
                </div>
                <ul className="space-y-2">
                  {[
                    'Pagina profissional',
                    'Ate 5 servicos',
                    'Agendamento online',
                    'WhatsApp integrado',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/register">Comecar gratis</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="border-primary shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                  Recomendado
                </span>
              </div>
              <CardContent className="p-6 space-y-4">
                <div>
                  <h3 className="font-semibold text-lg">Pro</h3>
                  <p className="text-sm text-muted-foreground">Tudo ilimitado</p>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">&euro;25</span>
                  <span className="text-muted-foreground text-sm">/mes</span>
                </div>
                <ul className="space-y-2">
                  {[
                    'Pagina profissional',
                    'Servicos ilimitados',
                    'Agendamento ilimitado',
                    'WhatsApp integrado',
                    'Bio gerada por IA',
                    'Notificacoes por email',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button asChild className="w-full">
                  <Link href="/register">Comecar 14 dias gratis</Link>
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Sem cartao para o teste. Cancele quando quiser.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          Pronto para ter sua pagina profissional?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
          Em 5 minutos voce cria sua pagina, adiciona servicos e ja pode compartilhar o link com seus clientes.
        </p>
        <Button asChild size="lg" className="gap-2">
          <Link href="/register">
            Criar minha pagina agora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm font-medium">CircleHood Booking</span>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} CircleHood Tech. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
