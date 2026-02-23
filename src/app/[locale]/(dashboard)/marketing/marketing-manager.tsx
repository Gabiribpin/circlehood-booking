'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { QrCode, CreditCard, Instagram, FileText, BarChart3 } from 'lucide-react';

// Import marketing components (we'll create these next)
import { QRGenerator } from '@/components/marketing/qr-generator';
import { BusinessCardGenerator } from '@/components/marketing/business-card-generator';
import { SocialPostGenerator } from '@/components/marketing/social-post-generator';
import { FlyerGenerator } from '@/components/marketing/flyer-generator';

interface MarketingManagerProps {
  professional: any;
  savedQRCodes: any[];
  totalScans: number;
}

export function MarketingManager({ professional, savedQRCodes, totalScans }: MarketingManagerProps) {
  const [activeTab, setActiveTab] = useState('qr-code');

  const bookingUrl = `https://circlehood-booking.vercel.app/${professional.slug}`;

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

      {/* Tabs for different marketing materials */}
      <Card>
        <CardContent className="p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-2">
              <TabsTrigger value="qr-code" className="gap-2">
                <QrCode className="h-4 w-4" />
                <span className="hidden sm:inline">QR Code</span>
              </TabsTrigger>
              <TabsTrigger value="business-card" className="gap-2">
                <CreditCard className="h-4 w-4" />
                <span className="hidden sm:inline">Cartão</span>
              </TabsTrigger>
              <TabsTrigger value="social-post" className="gap-2">
                <Instagram className="h-4 w-4" />
                <span className="hidden sm:inline">Posts</span>
              </TabsTrigger>
              <TabsTrigger value="flyer" className="gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">Flyers</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qr-code" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">QR Code Personalizado</h3>
                <p className="text-sm text-muted-foreground">
                  Crie QR codes personalizados com suas cores e logo para seus clientes escanearem e agendarem
                </p>
              </div>
              <QRGenerator
                url={bookingUrl}
                professionalId={professional.id}
                businessName={professional.business_name}
              />
            </TabsContent>

            <TabsContent value="business-card" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Cartão de Visita Digital</h3>
                <p className="text-sm text-muted-foreground">
                  Gere cartões de visita digitais profissionais para compartilhar nas redes sociais
                </p>
              </div>
              <BusinessCardGenerator
                professional={professional}
                bookingUrl={bookingUrl}
              />
            </TabsContent>

            <TabsContent value="social-post" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Posts para Redes Sociais</h3>
                <p className="text-sm text-muted-foreground">
                  Crie posts otimizados para Instagram Stories e Facebook
                </p>
              </div>
              <SocialPostGenerator
                professional={professional}
                bookingUrl={bookingUrl}
              />
            </TabsContent>

            <TabsContent value="flyer" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Flyers para Impressão</h3>
                <p className="text-sm text-muted-foreground">
                  Gere flyers em alta resolução (A4/A5) para impressão
                </p>
              </div>
              <FlyerGenerator
                professional={professional}
                bookingUrl={bookingUrl}
              />
            </TabsContent>
          </Tabs>
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
