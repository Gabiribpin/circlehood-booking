'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CreditCard, Instagram, FileText,
  Calendar, MessageCircle, ArrowLeft, ArrowRight, Check,
  RotateCcw, Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { QRGenerator } from '@/components/marketing/qr-generator';
import { BusinessCardGenerator } from '@/components/marketing/business-card-generator';
import { SocialPostGenerator } from '@/components/marketing/social-post-generator';
import { FlyerGenerator } from '@/components/marketing/flyer-generator';

interface MarketingManagerProps {
  professional: any;
  savedQRCodes: any[];
  totalScans: number;
  whatsappPhone: string | null;
}

type MaterialType = 'qr-booking' | 'qr-whatsapp' | 'business-card' | 'social-post' | 'flyer';
type QrTarget = 'booking' | 'whatsapp' | 'both';

interface MaterialOption {
  id: MaterialType;
  icon: LucideIcon;
  title: string;
  description: string;
  color: string;
}

export function MarketingManager({ professional, savedQRCodes, totalScans, whatsappPhone }: MarketingManagerProps) {
  const t = useTranslations('marketing');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [materialType, setMaterialType] = useState<MaterialType>('qr-booking');
  const [qrTarget, setQrTarget] = useState<QrTarget>('booking');

  const bookingUrl = `https://booking.circlehood-tech.com/${professional.slug}`;
  const whatsappUrl = whatsappPhone ? `https://wa.me/${whatsappPhone}` : bookingUrl;

  // Resolve URLs/CTA based on qrTarget
  const qrUrl = qrTarget === 'whatsapp' && whatsappPhone ? whatsappUrl : bookingUrl;
  const qrCtaText = qrTarget === 'whatsapp' ? t('ctaWhatsapp') : t('ctaBooking');

  const MATERIALS: MaterialOption[] = [
    {
      id: 'qr-booking',
      icon: Calendar,
      title: t('qrBookingTitle'),
      description: t('qrBookingDesc'),
      color: 'bg-primary/10 text-primary',
    },
    ...(whatsappPhone ? [{
      id: 'qr-whatsapp' as MaterialType,
      icon: MessageCircle,
      title: t('qrWhatsappTitle'),
      description: t('qrWhatsappDesc'),
      color: 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    }] : []),
    {
      id: 'business-card',
      icon: CreditCard,
      title: t('cardTitle'),
      description: t('cardWizardDesc'),
      color: 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    },
    {
      id: 'social-post',
      icon: Instagram,
      title: t('socialTitle'),
      description: t('socialWizardDesc'),
      color: 'bg-pink-100 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400',
    },
    {
      id: 'flyer',
      icon: FileText,
      title: t('flyerTitle'),
      description: t('flyerWizardDesc'),
      color: 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    },
  ];

  const steps = [
    { num: 1, label: t('stepChoose') },
    { num: 2, label: t('stepCustomize') },
    { num: 3, label: t('stepDownload') },
  ];

  function handleSelectMaterial(id: MaterialType) {
    setMaterialType(id);
    if (id === 'qr-whatsapp') {
      setQrTarget('whatsapp');
    } else if (id === 'qr-booking') {
      setQrTarget('booking');
    } else {
      // For card/post/flyer, default to both if WhatsApp is available
      setQrTarget(whatsappPhone ? 'both' : 'booking');
    }
    setStep(2);
  }

  function handleCreateAnother() {
    setStep(1);
    setMaterialType('qr-booking');
    setQrTarget('booking');
  }

  const showQrTargetToggle =
    whatsappPhone &&
    (materialType === 'business-card' || materialType === 'social-post' || materialType === 'flyer');

  const isQrType = materialType === 'qr-booking' || materialType === 'qr-whatsapp';

  const qrGeneratorUrl = materialType === 'qr-whatsapp' ? whatsappUrl : bookingUrl;

  // Props for generators when qrTarget === 'both'
  const generatorQrProps = qrTarget === 'both' && whatsappPhone
    ? { qrUrl: bookingUrl, qrCtaText: t('ctaBooking'), secondQrUrl: whatsappUrl, secondQrCtaText: t('ctaWhatsapp') }
    : { qrUrl, qrCtaText };

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-0">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                  step === s.num
                    ? 'bg-primary text-primary-foreground'
                    : step > s.num
                      ? 'bg-primary/20 text-primary'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {step > s.num ? <Check className="h-4 w-4" /> : s.num}
              </div>
              <span className={`text-xs font-medium ${
                step === s.num ? 'text-primary' : 'text-muted-foreground'
              }`}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-colors ${
                step > s.num ? 'bg-primary/40' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1 — Choose Material */}
      {step === 1 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t('wizardTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('wizardSubtitle')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MATERIALS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectMaterial(m.id)}
                  className="group p-5 rounded-xl border-2 border-border text-left transition-all hover:shadow-md hover:border-primary/40"
                >
                  <div className={`inline-flex p-3 rounded-lg mb-3 ${m.color}`}>
                    <m.icon className="h-6 w-6" />
                  </div>
                  <p className="font-semibold text-sm leading-tight">{m.title}</p>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {m.description}
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Customize */}
      {step === 2 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            {/* QR Target toggle for card/post/flyer */}
            {showQrTargetToggle && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('qrTargetLabel')}</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={qrTarget === 'booking' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQrTarget('booking')}
                    className="gap-2"
                  >
                    <Calendar className="h-4 w-4" />
                    {t('qrTargetBooking')}
                  </Button>
                  <Button
                    variant={qrTarget === 'whatsapp' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQrTarget('whatsapp')}
                    className="gap-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {t('qrTargetWhatsapp')}
                  </Button>
                  <Button
                    variant={qrTarget === 'both' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setQrTarget('both')}
                    className="gap-2"
                  >
                    <Layers className="h-4 w-4" />
                    {t('qrTargetBoth')}
                  </Button>
                </div>
              </div>
            )}

            {/* Generator — customize mode */}
            {isQrType && (
              <QRGenerator
                url={qrGeneratorUrl}
                professionalId={professional.id}
                businessName={professional.business_name}
                renderMode="customize"
              />
            )}
            {materialType === 'business-card' && (
              <BusinessCardGenerator
                professional={professional}
                bookingUrl={bookingUrl}
                renderMode="customize"
                {...generatorQrProps}
              />
            )}
            {materialType === 'social-post' && (
              <SocialPostGenerator
                professional={professional}
                bookingUrl={bookingUrl}
                renderMode="customize"
                {...generatorQrProps}
              />
            )}
            {materialType === 'flyer' && (
              <FlyerGenerator
                professional={professional}
                bookingUrl={bookingUrl}
                renderMode="customize"
                {...generatorQrProps}
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('backBtn')}
              </Button>
              <Button onClick={() => setStep(3)} className="gap-2">
                {t('nextBtn')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — Download & Share */}
      {step === 3 && (
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-semibold">{t('downloadTitle')}</h3>
              <p className="text-sm text-muted-foreground">{t('downloadSubtitle')}</p>
            </div>

            {/* Generator — actions mode */}
            {isQrType && (
              <QRGenerator
                url={qrGeneratorUrl}
                professionalId={professional.id}
                businessName={professional.business_name}
                renderMode="actions"
              />
            )}
            {materialType === 'business-card' && (
              <BusinessCardGenerator
                professional={professional}
                bookingUrl={bookingUrl}
                renderMode="actions"
                {...generatorQrProps}
              />
            )}
            {materialType === 'social-post' && (
              <SocialPostGenerator
                professional={professional}
                bookingUrl={bookingUrl}
                renderMode="actions"
                {...generatorQrProps}
              />
            )}
            {materialType === 'flyer' && (
              <FlyerGenerator
                professional={professional}
                bookingUrl={bookingUrl}
                renderMode="actions"
                {...generatorQrProps}
              />
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('backBtn')}
              </Button>
              <Button variant="outline" onClick={handleCreateAnother} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {t('createAnother')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
