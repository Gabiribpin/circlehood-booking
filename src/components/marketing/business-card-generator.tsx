'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, RefreshCw } from 'lucide-react';
import { ImageShareButtons } from '@/components/marketing/image-share-buttons';
import { generateQRDataURL } from '@/lib/marketing/qr-generator';
import { canvasToPNG } from '@/lib/marketing/export-utils';
import { drawGradientBackground, wrapText, drawMultilineText } from '@/lib/marketing/canvas-utils';
import { useToast } from '@/hooks/use-toast';

interface BusinessCardGeneratorProps {
  professional: any;
  bookingUrl: string;
  qrUrl?: string;
  qrCtaText?: string;
  secondQrUrl?: string;
  secondQrCtaText?: string;
  renderMode?: 'customize' | 'actions';
}

const CARD_WIDTH = 1050;
const CARD_HEIGHT = 600;

const GRADIENT_PRESETS = [
  { label: 'Azul', color1: '#2563EB', color2: '#1E40AF' },
  { label: 'Roxo', color1: '#7C3AED', color2: '#5B21B6' },
  { label: 'Verde', color1: '#059669', color2: '#047857' },
  { label: 'Rosa', color1: '#DB2777', color2: '#BE185D' },
  { label: 'Laranja', color1: '#EA580C', color2: '#C2410C' },
];

export function BusinessCardGenerator({
  professional, bookingUrl, qrUrl, qrCtaText, secondQrUrl, secondQrCtaText, renderMode,
}: BusinessCardGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [gradient, setGradient] = useState(GRADIENT_PRESETS[0]);
  const [customPhone, setCustomPhone] = useState(professional.phone || '');
  const [customInstagram, setCustomInstagram] = useState(professional.instagram || '');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const effectiveQrUrl = qrUrl || bookingUrl;
  const effectiveCtaText = qrCtaText || 'Escaneie para agendar';
  const hasDualQr = !!secondQrUrl;

  useEffect(() => {
    generatePreview();
  }, [gradient, customPhone, customInstagram, effectiveQrUrl, effectiveCtaText, secondQrUrl, secondQrCtaText]);

  async function generatePreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    try {
      drawGradientBackground(ctx, CARD_WIDTH, CARD_HEIGHT, gradient.color1, gradient.color2, 'diagonal');

      // Draw left side text first (before QR images load)
      const leftPadding = 50;
      const topPadding = 80;

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 42px Arial';
      ctx.textAlign = 'left';
      const maxTextWidth = hasDualQr ? 380 : 450;
      const nameLines = wrapText(ctx, professional.business_name, maxTextWidth);
      drawMultilineText(ctx, nameLines, leftPadding, topPadding, 50);

      if (professional.bio) {
        ctx.font = '18px Arial';
        ctx.fillStyle = '#F0F0F0';
        const bioLines = wrapText(ctx, professional.bio, maxTextWidth);
        drawMultilineText(ctx, bioLines.slice(0, 3), leftPadding, topPadding + (nameLines.length * 50) + 30, 28);
      }

      const contactY = CARD_HEIGHT - 120;
      ctx.font = '20px Arial';
      ctx.fillStyle = '#FFFFFF';

      if (customPhone) {
        ctx.fillText(`📱 ${customPhone}`, leftPadding, contactY);
      }
      if (customInstagram) {
        ctx.fillText(`📷 @${customInstagram.replace('@', '')}`, leftPadding, contactY + 35);
      }

      ctx.font = '16px monospace';
      ctx.fillStyle = '#E0E0E0';
      ctx.fillText(`circlehood.app/${professional.slug}`, leftPadding, contactY + 75);

      if (hasDualQr) {
        // Two QR codes stacked on the right
        const qrSize = 160;
        const qrPadding = 30;
        const qrX = CARD_WIDTH - qrSize - qrPadding - 20;
        const gap = 20;
        const totalHeight = qrSize * 2 + gap + 70; // 2 QR + gap + labels
        const startY = (CARD_HEIGHT - totalHeight) / 2;

        // First QR (booking)
        const qr1DataUrl = await generateQRDataURL(effectiveQrUrl, { color: '#000000', size: qrSize });
        // Second QR (whatsapp)
        const qr2DataUrl = await generateQRDataURL(secondQrUrl!, { color: '#000000', size: qrSize });

        const qr1Img = new Image();
        qr1Img.onload = () => {
          // White bg for first QR
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.roundRect(qrX - 15, startY - 15, qrSize + 30, qrSize + 50, 10);
          ctx.fill();
          ctx.drawImage(qr1Img, qrX, startY, qrSize, qrSize);
          ctx.fillStyle = '#666666';
          ctx.font = 'bold 13px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(effectiveCtaText.length > 25 ? '📅 Agendar' : effectiveCtaText, qrX + qrSize / 2, startY + qrSize + 25);

          const qr2Img = new Image();
          qr2Img.onload = () => {
            const qr2Y = startY + qrSize + 50 + gap;
            // White bg for second QR
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.roundRect(qrX - 15, qr2Y - 15, qrSize + 30, qrSize + 50, 10);
            ctx.fill();
            ctx.drawImage(qr2Img, qrX, qr2Y, qrSize, qrSize);
            ctx.fillStyle = '#666666';
            ctx.font = 'bold 13px Arial';
            ctx.textAlign = 'center';
            const shortCta2 = (secondQrCtaText || '').length > 25 ? '💬 WhatsApp' : (secondQrCtaText || '💬 WhatsApp');
            ctx.fillText(shortCta2, qrX + qrSize / 2, qr2Y + qrSize + 25);

            setPreviewUrl(canvas.toDataURL());
          };
          qr2Img.src = qr2DataUrl;
        };
        qr1Img.src = qr1DataUrl;
      } else {
        // Single QR code
        const qrSize = 220;
        const qrPadding = 40;
        const qrX = CARD_WIDTH - qrSize - qrPadding - 20;
        const qrY = (CARD_HEIGHT - qrSize - 60) / 2;

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 80, 15);
        ctx.fill();

        const qrDataUrl = await generateQRDataURL(effectiveQrUrl, { color: '#000000', size: qrSize });
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
          ctx.fillStyle = '#666666';
          ctx.font = 'bold 16px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(effectiveCtaText, qrX + qrSize / 2, qrY + qrSize + 40);
          setPreviewUrl(canvas.toDataURL());
        };
        qrImg.src = qrDataUrl;
      }
    } catch (error) {
      console.error('Error generating business card:', error);
      toast({ title: 'Erro', description: 'Falha ao gerar cartão de visita', variant: 'destructive' });
    }
  }

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setLoading(true);
    try {
      canvasToPNG(canvas, `cartao-${professional.slug}`);
      toast({ title: 'Sucesso!', description: 'Cartão de visita baixado com sucesso' });
    } catch (error) {
      console.error('Error downloading card:', error);
      toast({ title: 'Erro', description: 'Falha ao baixar cartão', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function getCardBlob(): Promise<Blob | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }

  if (renderMode === 'customize') {
    return (
      <div className="space-y-6">
        <div className="bg-muted rounded-lg p-4 flex items-center justify-center">
          {previewUrl ? (
            <div className="w-full max-w-sm shadow-xl rounded-lg overflow-hidden">
              <img src={previewUrl} alt="Business Card Preview" className="w-full h-auto" />
            </div>
          ) : (
            <p className="text-muted-foreground">Gerando preview...</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Estilo de Fundo</Label>
          <div className="grid grid-cols-2 gap-2">
            {GRADIENT_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant={gradient === preset ? 'default' : 'outline'}
                size="sm"
                onClick={() => setGradient(preset)}
                className="justify-start gap-2"
              >
                <div className="w-4 h-4 rounded" style={{ background: `linear-gradient(135deg, ${preset.color1}, ${preset.color2})` }} />
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone (opcional)</Label>
          <Input id="phone" value={customPhone} onChange={(e) => setCustomPhone(e.target.value)} placeholder="+351 91 234 5678" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="instagram">Instagram (opcional)</Label>
          <Input id="instagram" value={customInstagram} onChange={(e) => setCustomInstagram(e.target.value)} placeholder="@seunegocio" />
        </div>

        <Button onClick={generatePreview} variant="outline" className="w-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar Preview
        </Button>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  if (renderMode === 'actions') {
    return (
      <div className="space-y-4">
        <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[300px]">
          {previewUrl ? (
            <div className="w-full max-w-md shadow-2xl rounded-lg overflow-hidden">
              <img src={previewUrl} alt="Business Card Preview" className="w-full h-auto" />
            </div>
          ) : (
            <p className="text-muted-foreground">Gerando preview...</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleDownload} disabled={loading || !previewUrl} className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Baixar Cartão (PNG)
          </Button>
          <ImageShareButtons getBlob={getCardBlob} filename={`cartao-${professional.slug}`} />
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Alta resolução (1050x600px) — Perfeito para compartilhar em redes sociais
        </p>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  // Default mode (backward compat)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Preview</h4>
              <span className="text-xs text-muted-foreground">1050x600px</span>
            </div>
            <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[300px]">
              {previewUrl ? (
                <div className="w-full max-w-md shadow-2xl rounded-lg overflow-hidden">
                  <img src={previewUrl} alt="Business Card Preview" className="w-full h-auto" />
                </div>
              ) : (
                <p className="text-muted-foreground">Gerando preview...</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} disabled={loading || !previewUrl} className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Baixar Cartão (PNG)
              </Button>
              <ImageShareButtons getBlob={getCardBlob} filename={`cartao-${professional.slug}`} />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">Personalização</h4>
              <div className="space-y-2 mb-4">
                <Label>Estilo de Fundo</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GRADIENT_PRESETS.map((preset) => (
                    <Button key={preset.label} variant={gradient === preset ? 'default' : 'outline'} size="sm" onClick={() => setGradient(preset)} className="justify-start gap-2">
                      <div className="w-4 h-4 rounded" style={{ background: `linear-gradient(135deg, ${preset.color1}, ${preset.color2})` }} />
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <Label htmlFor="phone-default">Telefone (opcional)</Label>
                <Input id="phone-default" value={customPhone} onChange={(e) => setCustomPhone(e.target.value)} placeholder="+351 91 234 5678" />
              </div>
              <div className="space-y-2 mb-4">
                <Label htmlFor="instagram-default">Instagram (opcional)</Label>
                <Input id="instagram-default" value={customInstagram} onChange={(e) => setCustomInstagram(e.target.value)} placeholder="@seunegocio" />
              </div>
              <Button onClick={generatePreview} variant="outline" className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Preview
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
