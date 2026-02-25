'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QrCode, CreditCard, Instagram, FileText, BarChart3 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { QRGenerator } from '@/components/marketing/qr-generator';
import { BusinessCardGenerator } from '@/components/marketing/business-card-generator';
import { SocialPostGenerator } from '@/components/marketing/social-post-generator';
import { FlyerGenerator } from '@/components/marketing/flyer-generator';

interface MarketingManagerProps {
  professional: any;
  savedQRCodes: any[];
  totalScans: number;
}

type ToolId = 'qr-code' | 'business-card' | 'social-post' | 'flyer';

export function MarketingManager({ professional, savedQRCodes, totalScans }: MarketingManagerProps) {
  const t = useTranslations('marketing');
  const [activeTool, setActiveTool] = useState<ToolId>('qr-code');

  const TOOLS: { id: ToolId; icon: LucideIcon; title: string; description: string; color: string }[] = [
    {
      id: 'qr-code',
      icon: QrCode,
      title: t('qrTitle'),
      description: t('qrDesc'),
      color: 'bg-primary/10 text-primary',
    },
    {
      id: 'business-card',
      icon: CreditCard,
      title: t('cardTitle'),
      description: t('cardDesc'),
      color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'social-post',
      icon: Instagram,
      title: t('socialTitle'),
      description: t('socialDesc'),
      color: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
    },
    {
      id: 'flyer',
      icon: FileText,
      title: t('flyerTitle'),
      description: t('flyerDesc'),
      color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    },
  ];

  const bookingUrl = `https://circlehood-booking.vercel.app/${professional.slug}`;
  const currentTool = TOOLS.find((tool) => tool.id === activeTool)!;

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
                <p className="text-xs text-muted-foreground">{t('statsQRCodes')}</p>
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
                <p className="text-xs text-muted-foreground">{t('statsTotalScans')}</p>
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
                <p className="text-xs text-muted-foreground">{t('statsMaterials')}</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">4</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
            {t('tipsTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>{t('tip1')}</li>
            <li>{t('tip2')}</li>
            <li>{t('tip3')}</li>
            <li>{t('tip4')}</li>
            <li>{t('tip5')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
