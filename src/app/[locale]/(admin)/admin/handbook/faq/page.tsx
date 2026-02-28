'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft, ChevronDown } from 'lucide-react';
import Link from 'next/link';

const faqData = [
  {
    category: '🔥 PRIORIZAÇÃO',
    color: 'border-red-300 dark:border-red-800',
    headerBg: 'bg-red-50 dark:bg-red-950/30',
    items: [
      {
        q: 'Como sei se é crítico?',
        a: '🔴 CRÍTICO: Cliente não consegue pagar, sistema fora, dados vazados = RESOLVE AGORA\n🟠 URGENTE: Email não chega, bot não responde, agendamento falha = 4 horas\n🟡 IMPORTANTE: Erro visual, confusão UX, sugestão boa = 24h\n🟢 NORMAL: Feature nova, ajuste estético = 1 semana',
      },
      {
        q: "Cliente diz 'urgente' mas não é. E agora?",
        a: "Responda: 'Oi! Vi sua mensagem. Isso não afeta o sistema agora, então resolvo em [prazo]. Tá funcionando normal! Qualquer coisa, me chama! 💜'",
      },
      {
        q: 'Quantas horas devo trabalhar nisso por dia?',
        a: 'LIMITE: 1h40/dia durante semana + 3h sábado = 11h20/semana MAX\nSe precisar mais = algo está errado, precisa melhorar processo!',
      },
    ],
  },
  {
    category: '💬 COMUNICAÇÃO COM CLIENTES',
    color: 'border-blue-300 dark:border-blue-800',
    headerBg: 'bg-blue-50 dark:bg-blue-950/30',
    items: [
      {
        q: 'Cliente reportou bug. O que responder?',
        a: "IMEDIATO: 'Oi [nome]! Vi o problema. Estou resolvendo [prazo]. Te aviso! 💜'\nDEPOIS DE RESOLVER: 'Pronto! Testa aí e me diz se funcionou! 😊'",
      },
      {
        q: 'Não consigo resolver agora. E se demorar?',
        a: "SEJA HONESTA: 'Oi! Esse bug é complexo. Vou resolver até [data realista]. Desculpa a demora, mas quero fazer certo! 💜'\nClientes preferem HONESTIDADE que promessa quebrada!",
      },
      {
        q: 'Cliente pediu feature que não vou fazer. Como negar?',
        a: "'Adorei a ideia! Mas agora estou focada em [prioridade atual]. Anotei pro roadmap futuro! Continue mandando sugestões! 💡'",
      },
    ],
  },
  {
    category: '⏰ QUANDO TRABALHAR',
    color: 'border-amber-300 dark:border-amber-800',
    headerBg: 'bg-amber-50 dark:bg-amber-950/30',
    items: [
      {
        q: 'Posso trabalhar de madrugada?',
        a: '❌ NÃO! Depois das 23h = PROIBIDO\nVocê precisa dormir. Noah acorda cedo. José precisa de você.\nSE for 🔴 crítico: Avisa cliente "resolvo amanhã cedo" e DORME!',
      },
      {
        q: 'E domingo?',
        a: '❌ ZERO CircleHood!\nDomingo = família, descanso, recarga.\nÚNICA exceção: Sistema totalmente fora afetando todos.',
      },
      {
        q: 'Cliente me manda mensagem 22h. Respondo?',
        a: '❌ NÃO! Responde amanhã cedo (7h-8h)\nSe for 🔴: "Vi! Resolvo primeira hora amanhã!"\nClientes respeitam horário quando você respeita seu próprio!',
      },
    ],
  },
  {
    category: '🆘 QUANDO PEDIR AJUDA',
    color: 'border-purple-300 dark:border-purple-800',
    headerBg: 'bg-purple-50 dark:bg-purple-950/30',
    items: [
      {
        q: 'Quando chamar Claude (IA)?',
        a: '✅ Bug complexo que não sei resolver\n✅ Preciso implementar algo rápido\n✅ Preciso revisar código antes deploy\n✅ Dúvida de arquitetura\n✅ Sempre que precisar! Claude está aqui pra isso! 💜',
      },
      {
        q: 'Tô sobrecarregada. O que fazer?',
        a: '1. PARE 5 minutos. Respira.\n2. Lista TUDO que precisa fazer\n3. Prioriza (🔴🟠🟡🟢)\n4. Faz SÓ 🔴 e 🟠 hoje\n5. Resto = amanhã/semana\n6. Avisa clientes: "Resolvendo por prioridade!"\n7. NÃO se culpe. Você é humana.',
      },
    ],
  },
  {
    category: '💰 FINANCEIRO',
    color: 'border-green-300 dark:border-green-800',
    headerBg: 'bg-green-50 dark:bg-green-950/30',
    items: [
      {
        q: 'Cliente pediu reembolso. Dou?',
        a: 'SE: Bug crítico não resolvido, trial com problemas sérios\n→ SIM, sem questionar. Mantém reputação!\n\nSE: Só não gostou, mudou de ideia\n→ Trial: reembolso total\n→ Pago 1 mês: reembolso proporcional\n→ Pago 2+ meses: sem reembolso (termos de uso)\n\nSEMPRE seja gentil!',
      },
      {
        q: 'Quanto cobrar por customização?',
        a: 'REGRA: 3x o valor mensal\nPequena customização: €60 (3x €19)\nMédia customização: €120\nGrande customização: €200+\n\nOu adiciona na roadmap grátis se beneficiar todos!',
      },
    ],
  },
];

export default function HandbookFAQPage() {
  const [search, setSearch] = useState('');

  const filtered = faqData
    .map((cat) => ({
      ...cat,
      items: cat.items.filter(
        (item) =>
          !search ||
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          item.a.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter((cat) => cat.items.length > 0);

  const totalItems = faqData.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      <Link
        href="/admin/handbook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Handbook
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">❓ FAQ Operacional</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {totalItems} respostas para nunca ficar perdida
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar pergunta ou resposta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground text-center py-8">
          Nenhum resultado para &quot;{search}&quot;
        </p>
      )}

      <div className="space-y-6">
        {filtered.map((cat) => (
          <div key={cat.category} className={`rounded-xl border-2 overflow-hidden ${cat.color}`}>
            <div className={`px-4 py-3 font-bold text-sm ${cat.headerBg}`}>
              {cat.category}
            </div>
            <div className="divide-y">
              {cat.items.map((item, i) => (
                <details key={i} className="group bg-background">
                  <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-muted/30 transition-colors">
                    <span className="text-sm font-medium">{item.q}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 pt-1">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
