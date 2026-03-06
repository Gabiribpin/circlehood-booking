'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import { Download, Instagram, Facebook } from 'lucide-react';
import { ImageShareButtons } from '@/components/marketing/image-share-buttons';
import { generateQRDataURL } from '@/lib/marketing/qr-generator';
import { canvasToPNG } from '@/lib/marketing/export-utils';
import { drawGradientBackground, wrapText, drawMultilineText } from '@/lib/marketing/canvas-utils';
import { useToast } from '@/hooks/use-toast';

interface SocialPostGeneratorProps {
  professional: any;
  bookingUrl: string;
  qrUrl?: string;
  qrCtaText?: string;
  secondQrUrl?: string;
  secondQrCtaText?: string;
  renderMode?: 'customize' | 'actions';
}

type PostFormat = 'instagram-story' | 'facebook-post';

const POST_FORMATS = {
  'instagram-story': { width: 1080, height: 1920, label: 'Instagram Stories' },
  'facebook-post': { width: 1200, height: 1200, label: 'Facebook Post' },
};

const GRADIENT_THEMES = [
  { label: 'Moderno', color1: '#667EEA', color2: '#764BA2' },
  { label: 'Quente', color1: '#F093FB', color2: '#F5576C' },
  { label: 'Oceano', color1: '#4FACFE', color2: '#00F2FE' },
  { label: 'Sunset', color1: '#FA709A', color2: '#FEE140' },
  { label: 'Mint', color1: '#A8EDEA', color2: '#2AF598' },
];

export function SocialPostGenerator({ professional, bookingUrl, qrUrl, qrCtaText, secondQrUrl, secondQrCtaText, renderMode }: SocialPostGeneratorProps) {
  const t = useTranslations('marketing');
  const [format, setFormat] = useState<PostFormat>('instagram-story');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [theme, setTheme] = useState(GRADIENT_THEMES[0]);
  const [customTitle, setCustomTitle] = useState('Agende Comigo!');
  const [customMessage, setCustomMessage] = useState('Acesse o link e escolha o melhor horário para você');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const effectiveQrUrl = qrUrl || bookingUrl;
  const effectiveCtaText = qrCtaText || t('ctaBooking');
  const hasDualQr = !!secondQrUrl;

  useEffect(() => {
    generatePreview();
  }, [format, theme, customTitle, customMessage, effectiveQrUrl, effectiveCtaText, secondQrUrl, secondQrCtaText]);

  async function generatePreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dimensions = POST_FORMATS[format];
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    try {
      drawGradientBackground(ctx, canvas.width, canvas.height, theme.color1, theme.color2, 'diagonal');

      const centerX = canvas.width / 2;

      // Helper to draw text overlay after QR codes
      function drawTextOverlay(qrY: number, qrSize: number, bgPadding: number) {
        if (!ctx || !canvas) return;
        // Business name at top
        const topY = format === 'instagram-story' ? 200 : 150;
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 10;
        ctx.fillText(professional.business_name, centerX, topY);
        ctx.shadowBlur = 0;

        // Custom title
        ctx.font = 'bold 48px Arial';
        const titleY = qrY - 80;
        const titleLines = wrapText(ctx, customTitle, canvas.width - 100);
        titleLines.forEach((line, i) => {
          ctx.fillText(line, centerX, titleY + (i * 55));
        });

        // Custom message below QR area
        const messageY = qrY + qrSize + bgPadding + 60;
        ctx.font = '32px Arial';
        ctx.fillStyle = '#FFFFFF';
        const messageLines = wrapText(ctx, customMessage, canvas.width - 100);
        messageLines.forEach((line, i) => {
          ctx.fillText(line, centerX, messageY + (i * 42));
        });

        // URL at bottom
        const bottomY = canvas.height - 100;
        ctx.font = 'bold 28px monospace';
        ctx.fillStyle = '#FFFFFF';
        const shortUrl = `booking.circlehood-tech.com/${professional.slug}`;
        ctx.fillText(shortUrl, centerX, bottomY);

        setPreviewUrl(canvas.toDataURL());
      }

      if (hasDualQr) {
        // Two QR codes side by side
        const qrSize = format === 'instagram-story' ? 220 : 200;
        const gap = 40;
        const bgPadding = 20;
        const qrY = format === 'instagram-story'
          ? canvas.height / 2 - qrSize / 2 + 100
          : canvas.height / 2 - qrSize / 2 + 50;

        const qr1X = centerX - qrSize - gap / 2;
        const qr2X = centerX + gap / 2;

        const [qr1DataUrl, qr2DataUrl] = await Promise.all([
          generateQRDataURL(effectiveQrUrl, { color: '#000000', size: qrSize }),
          generateQRDataURL(secondQrUrl!, { color: '#000000', size: qrSize }),
        ]);

        const qr1Img = new Image();
        qr1Img.onload = () => {
          // White bg + draw QR1
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.roundRect(qr1X - bgPadding, qrY - bgPadding, qrSize + bgPadding * 2, qrSize + bgPadding * 2 + 40, 15);
          ctx.fill();
          ctx.drawImage(qr1Img, qr1X, qrY, qrSize, qrSize);
          ctx.fillStyle = '#666666';
          ctx.font = 'bold 18px Arial';
          ctx.textAlign = 'center';
          ctx.fillText('📅 Agendar', qr1X + qrSize / 2, qrY + qrSize + bgPadding + 25);

          const qr2Img = new Image();
          qr2Img.onload = () => {
            // White bg + draw QR2
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.roundRect(qr2X - bgPadding, qrY - bgPadding, qrSize + bgPadding * 2, qrSize + bgPadding * 2 + 40, 15);
            ctx.fill();
            ctx.drawImage(qr2Img, qr2X, qrY, qrSize, qrSize);
            ctx.fillStyle = '#666666';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('💬 WhatsApp', qr2X + qrSize / 2, qrY + qrSize + bgPadding + 25);

            drawTextOverlay(qrY, qrSize + 40, bgPadding);
          };
          qr2Img.src = qr2DataUrl;
        };
        qr1Img.src = qr1DataUrl;
      } else {
        // Single QR code
        const qrSize = format === 'instagram-story' ? 300 : 250;
        const bgPadding = 30;
        const qrY = format === 'instagram-story'
          ? canvas.height / 2 - qrSize / 2 + 100
          : canvas.height / 2 - qrSize / 2 + 50;

        const qrDataUrl = await generateQRDataURL(effectiveQrUrl, { color: '#000000', size: qrSize });
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.roundRect(centerX - qrSize / 2 - bgPadding, qrY - bgPadding, qrSize + bgPadding * 2, qrSize + bgPadding * 2, 20);
          ctx.fill();
          ctx.drawImage(qrImg, centerX - qrSize / 2, qrY, qrSize, qrSize);

          drawTextOverlay(qrY, qrSize, bgPadding);
        };
        qrImg.src = qrDataUrl;
      }

    } catch (error) {
      logger.error('Error generating social post:', error);
      toast({
        title: t('toastError'),
        description: t('toastPostFailed'),
        variant: 'destructive',
      });
    }
  }

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    try {
      const filename = `${format}-${professional.slug}`;
      canvasToPNG(canvas, filename);

      toast({
        title: t('toastSuccess'),
        description: t('toastPostDownloaded'),
      });
    } catch (error) {
      logger.error('Error downloading post:', error);
      toast({
        title: t('toastError'),
        description: t('toastPostDownloadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function getPostBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  // Customize mode: only customization controls + small preview
  if (renderMode === 'customize') {
    return (
      <div className="space-y-6">
        {/* Small Preview */}
        <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[250px]">
          {previewUrl ? (
            <div className={`shadow-xl rounded-lg overflow-hidden ${
              format === 'instagram-story' ? 'max-w-[180px]' : 'max-w-[220px]'
            }`}>
              <img src={previewUrl} alt="Social Post Preview" className="w-full h-auto" />
            </div>
          ) : (
            <p className="text-muted-foreground">{t('generatingPreview')}</p>
          )}
        </div>

        {/* Format Selector */}
        <div className="space-y-2">
          <Label>{t('socialFormatLabel')}</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={format === 'instagram-story' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormat('instagram-story')}
              className="gap-2"
            >
              <Instagram className="h-4 w-4" />
              Stories
            </Button>
            <Button
              variant={format === 'facebook-post' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFormat('facebook-post')}
              className="gap-2"
            >
              <Facebook className="h-4 w-4" />
              Facebook
            </Button>
          </div>
        </div>

        {/* Theme Selection */}
        <div className="space-y-2">
          <Label>{t('flyerColorLabel')}</Label>
          <div className="grid grid-cols-2 gap-2">
            {GRADIENT_THEMES.map((gt) => (
              <Button
                key={gt.label}
                variant={theme === gt ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme(gt)}
                className="justify-start gap-2"
              >
                <div
                  className="w-4 h-4 rounded"
                  style={{
                    background: `linear-gradient(135deg, ${gt.color1}, ${gt.color2})`,
                  }}
                />
                {gt.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Title */}
        <div className="space-y-2">
          <Label htmlFor="title">{t('socialTitleLabel')}</Label>
          <Input
            id="title"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Agende Comigo!"
            maxLength={50}
          />
        </div>

        {/* Custom Message */}
        <div className="space-y-2">
          <Label htmlFor="message">{t('socialMessageLabel')}</Label>
          <Textarea
            id="message"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Acesse o link e escolha o melhor horário..."
            rows={3}
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground">
            {customMessage.length}/120 caracteres
          </p>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  // Actions mode: large preview + download/share
  if (renderMode === 'actions') {
    return (
      <div className="space-y-4">
        {/* Large Preview */}
        <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[400px]">
          {previewUrl ? (
            <div className={`shadow-2xl rounded-lg overflow-hidden ${
              format === 'instagram-story' ? 'max-w-[250px]' : 'max-w-[300px]'
            }`}>
              <img src={previewUrl} alt="Social Post Preview" className="w-full h-auto" />
            </div>
          ) : (
            <p className="text-muted-foreground">{t('generatingPreview')}</p>
          )}
        </div>

        {/* Download + Share */}
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownload} disabled={loading || !previewUrl} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            {t('socialDownload')}
          </Button>
          <ImageShareButtons
            getBlob={getPostBlob}
            filename={`${format}-${professional.slug}`}
          />
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  // Default mode: full layout (backward compat)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Preview */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Preview</h4>
              <span className="text-xs text-muted-foreground">
                {POST_FORMATS[format].width}x{POST_FORMATS[format].height}px
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={format === 'instagram-story' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('instagram-story')}
                className="gap-2"
              >
                <Instagram className="h-4 w-4" />
                Stories
              </Button>
              <Button
                variant={format === 'facebook-post' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormat('facebook-post')}
                className="gap-2"
              >
                <Facebook className="h-4 w-4" />
                Facebook
              </Button>
            </div>

            <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[400px]">
              {previewUrl ? (
                <div
                  className={`shadow-2xl rounded-lg overflow-hidden ${
                    format === 'instagram-story' ? 'max-w-[250px]' : 'max-w-[300px]'
                  }`}
                >
                  <img src={previewUrl} alt="Social Post Preview" className="w-full h-auto" />
                </div>
              ) : (
                <p className="text-muted-foreground">{t('generatingPreview')}</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} disabled={loading || !previewUrl} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                {t('socialDownload')}
              </Button>
              <ImageShareButtons
                getBlob={getPostBlob}
                filename={`${format}-${professional.slug}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customization */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">{t('stepCustomize')}</h4>

              <div className="space-y-2 mb-4">
                <Label>{t('flyerColorLabel')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GRADIENT_THEMES.map((t) => (
                    <Button
                      key={t.label}
                      variant={theme === t ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTheme(t)}
                      className="justify-start gap-2"
                    >
                      <div
                        className="w-4 h-4 rounded"
                        style={{
                          background: `linear-gradient(135deg, ${t.color1}, ${t.color2})`,
                        }}
                      />
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="title-default">{t('socialTitleLabel')}</Label>
                <Input
                  id="title-default"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Agende Comigo!"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2 mb-4">
                <Label htmlFor="message-default">{t('socialMessageLabel')}</Label>
                <Textarea
                  id="message-default"
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Acesse o link e escolha o melhor horário..."
                  rows={3}
                  maxLength={120}
                />
                <p className="text-xs text-muted-foreground">
                  {customMessage.length}/120 caracteres
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 text-sm">Dicas</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Instagram Stories: ideal para engajamento rápido</li>
                <li>Facebook Post: melhor para feeds e compartilhamentos</li>
                <li>Poste regularmente para manter audiência engajada</li>
                <li>Use hashtags relevantes ao seu negócio</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
