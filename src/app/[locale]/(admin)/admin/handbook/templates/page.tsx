'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import Link from 'next/link';

const templatesData: Record<string, Array<{ titulo: string; template: string }>> = {
  'Respostas Clientes': [
    {
      titulo: 'Bug Crítico',
      template:
        'Oi [NOME]! 😊\n\nVi o problema que você reportou.\nEstou resolvendo AGORA.\n\nPrevisão: [X] horas\nTe aviso assim que corrigir!\n\nDesculpa o transtorno! 💜\n- Gabi',
    },
    {
      titulo: 'Bug Resolvido',
      template:
        'Oi [NOME]! ✅\n\nPronto! Resolvi o problema.\n\nTesta aí e me diz se funcionou!\n\nObrigada pela paciência! 😊\n- Gabi',
    },
    {
      titulo: 'Vai Demorar',
      template:
        'Oi [NOME]!\n\nEsse problema é mais complexo.\nVou resolver até [DATA/HORA].\n\nDesculpa a demora, mas quero fazer certo! 💜\n\nTe atualizo assim que tiver novidade!\n- Gabi',
    },
    {
      titulo: 'Reembolso Aprovado',
      template:
        'Oi [NOME]!\n\nSem problema, te reembolso sim!\n\nProcesso em até 5-7 dias úteis.\n\nSe mudar de ideia, volta sempre! 😊\n- Gabi',
    },
    {
      titulo: 'Sugestão Recebida',
      template:
        'Oi [NOME]! 💡\n\nAdorei sua sugestão sobre [X]!\n\nAdicionei no roadmap de melhorias.\nImplemento nas próximas semanas!\n\nContinue mandando ideias! ✨\n- Gabi',
    },
  ],
  'Auto-responder WhatsApp': [
    {
      titulo: 'Fora do Horário',
      template:
        'Oi! Sou a Gabi, criadora do CircleHood! 👋\n\nRecebi sua mensagem fora do horário de atendimento.\n\nRespondo:\n🌅 Seg-Sex: 7h-23h\n☀️ Sábado: 9h-18h\n\nUrgente? Me manda "URGENTE" que eu vejo assim que possível!\n\nObrigada! 💜',
    },
  ],
  Comunicados: [
    {
      titulo: 'Manutenção Programada',
      template:
        '📢 Manutenção CircleHood\n\n[DATA] às [HORA]\nDuração: ~30 minutos\n\nO que: [Melhoria X]\nImpacto: Sistema fica fora\n\nAgendem antes/depois desse horário!\n\nObrigada! 💜\n- Gabi',
    },
    {
      titulo: 'Nova Feature',
      template:
        '🎉 Novidade no CircleHood!\n\n[FEATURE NOVA]\n\nComo usar:\n1. [Passo 1]\n2. [Passo 2]\n\nDúvidas? Me chama!\n\nAproveitem! ✨\n- Gabi',
    },
  ],
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="shrink-0 h-7 px-2 text-xs gap-1"
      onClick={handleCopy}
    >
      {copied ? (
        <><Check className="h-3 w-3 text-green-500" /> Copiado!</>
      ) : (
        <><Copy className="h-3 w-3" /> Copiar</>
      )}
    </Button>
  );
}

export default function HandbookTemplatesPage() {
  const totalTemplates = Object.values(templatesData).reduce((acc, arr) => acc + arr.length, 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 max-w-4xl">
      <Link
        href="/admin/handbook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Handbook
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">📋 Templates</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {totalTemplates} mensagens prontas para copiar e colar — nunca improvise!
        </p>
      </div>

      <div className="space-y-8">
        {Object.entries(templatesData).map(([category, templates]) => (
          <div key={category}>
            <h2 className="font-bold text-base mb-3 text-muted-foreground uppercase text-xs tracking-wider">
              {category}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {templates.map((tpl) => (
                <Card key={tpl.titulo} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm font-semibold">{tpl.titulo}</CardTitle>
                      <CopyButton text={tpl.template} />
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed bg-muted/50 rounded-lg p-3">
                      {tpl.template}
                    </pre>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            💡 Dica: Substitua os textos entre [COLCHETES] antes de enviar!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
