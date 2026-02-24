'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, CreditCard, Instagram, FileText, BarChart3 } from 'lucide-react';

import { QRGenerator } from '@/components/marketing/qr-generator';
import { BusinessCardGenerator } from '@/components/marketing/business-card-generator';
import { SocialPostGenerator } from '@/components/marketing/social-post-generator';
import { FlyerGenerator } from '@/components/marketing/flyer-generator';
import { ShareButtons } from '@/components/marketing/share-buttons';

interface MarketingManagerProps {
  professional: any;
  savedQRCodes: any[];
  totalScans: number;
}

const TOOLS = [
  {
    id: 'qr-code',
    icon: QrCode,
    title: 'QR Code',
    description: 'QR codes personalizados com suas cores para clientes escanearem e agendarem',
    color: 'bg-primary/10 text-primary',
  },
  {
    id: 'business-card',
    icon: CreditCard,
    title: 'Cartão de Visita',
    description: 'Cartões digitais profissionais para compartilhar nas redes sociais',
    color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
  },
  {
    id: 'social-post',
    icon: Instagram,
    title: 'Posts Sociais',
    description: 'Posts otimizados para Instagram Stories e Facebook',
    color: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
  },
  {
    id: 'flyer',
    icon: FileText,
    title: 'Flyers',
    description: 'Flyers em alta resolução (A4/A5) para impressão e distribuição',
    color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  },
] as const;

type ToolId = (typeof TOOLS)[number]['id'];

export function MarketingManager({ professional, savedQRCodes, totalScans }: MarketingManagerProps) {
  const [activeTool, setActiveTool] = useState<ToolId>('qr-code');

  const bookingUrl = `https://circlehood-booking.vercel.app/${professional.slug}`;
  const currentTool = TOOLS.find((t) => t.id === activeTool)!;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <QrCode className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">QR Codes</p>
                <p className="text-2xl font-bold">{savedQRCodes.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Escaneamentos</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{totalScans}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Materiais</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">4</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Share booking link */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            🔗 Compartilhe seu link de agendamento
          </CardTitle>
          <CardDescription>Envie diretamente para seus clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-background rounded-lg border text-sm">
            <code className="flex-1 truncate text-muted-foreground">{bookingUrl}</code>
          </div>
          <ShareButtons
            url={bookingUrl}
            title={`Agende com ${professional.business_name}`}
            text="Clique para agendar:"
          />
        </CardContent>
      </Card>

      {/* Tool selector grid */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {TOOLS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`group p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  activeTool === tool.id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className={`inline-flex p-2.5 rounded-lg mb-3 ${tool.color}`}>
                  <tool.icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-sm leading-tight">{tool.title}</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                  {tool.description}
                </p>
              </button>
            ))}
          </div>

          {/* Active tool content */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{currentTool.title}</h3>
              <p className="text-sm text-muted-foreground">{currentTool.description}</p>
            </div>

            {activeTool === 'qr-code' && (
              <QRGenerator
                url={bookingUrl}
                professionalId={professional.id}
                businessName={professional.business_name}
              />
            )}
            {activeTool === 'business-card' && (
              <BusinessCardGenerator professional={professional} bookingUrl={bookingUrl} />
            )}
            {activeTool === 'social-post' && (
              <SocialPostGenerator professional={professional} bookingUrl={bookingUrl} />
            )}
            {activeTool === 'flyer' && (
              <FlyerGenerator professional={professional} bookingUrl={bookingUrl} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            💡 Dicas de Marketing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Use QR codes em cartões de visita físicos e materiais impressos</li>
            <li>Poste regularmente nos Stories do Instagram para engajar seus seguidores</li>
            <li>Imprima flyers e distribua em estabelecimentos parceiros</li>
            <li>Adicione seu link de agendamento na bio do Instagram e Facebook</li>
            <li>Compartilhe posts com seus horários disponíveis semanalmente</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
