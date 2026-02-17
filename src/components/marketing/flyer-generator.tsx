'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Download, Printer, FileText } from 'lucide-react';
import { generateQRDataURL } from '@/lib/marketing/qr-generator';
import { canvasToPNG, printCanvas } from '@/lib/marketing/export-utils';
import { drawGradientBackground, wrapText, drawMultilineText } from '@/lib/marketing/canvas-utils';
import { useToast } from '@/hooks/use-toast';

interface FlyerGeneratorProps {
  professional: any;
  bookingUrl: string;
}

type FlyerSize = 'a4' | 'a5';

const FLYER_SIZES = {
  'a4': { width: 2480, height: 3508, label: 'A4 (210x297mm)' },
  'a5': { width: 1748, height: 2480, label: 'A5 (148x210mm)' },
};

const COLOR_SCHEMES = [
  { label: 'Profissional', primary: '#1E40AF', secondary: '#3B82F6', bg: '#EFF6FF' },
  { label: 'Elegante', primary: '#5B21B6', secondary: '#8B5CF6', bg: '#F5F3FF' },
  { label: 'Fresco', primary: '#047857', secondary: '#10B981', bg: '#ECFDF5' },
  { label: 'Vibrante', primary: '#DC2626', secondary: '#F87171', bg: '#FEF2F2' },
  { label: 'Moderno', primary: '#0891B2', secondary: '#22D3EE', bg: '#ECFEFF' },
];

export function FlyerGenerator({ professional, bookingUrl }: FlyerGeneratorProps) {
  const [size, setSize] = useState<FlyerSize>('a4');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [colorScheme, setColorScheme] = useState(COLOR_SCHEMES[0]);
  const [customHeadline, setCustomHeadline] = useState('Agende seu horário agora!');
  const [customDescription, setCustomDescription] = useState('');
  const [showPhone, setShowPhone] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    generatePreview();
  }, [size, colorScheme, customHeadline, customDescription, showPhone]);

  async function generatePreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dimensions = FLYER_SIZES[size];
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    try {
      // Background color
      ctx.fillStyle = colorScheme.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Header section with gradient
      const headerHeight = canvas.height * 0.25;
      drawGradientBackground(
        ctx,
        canvas.width,
        headerHeight,
        colorScheme.primary,
        colorScheme.secondary,
        'horizontal'
      );

      // Business name in header
      const centerX = canvas.width / 2;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${size === 'a4' ? '120' : '90'}px Arial`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 15;

      const businessNameLines = wrapText(ctx, professional.business_name, canvas.width - 200);
      const nameStartY = headerHeight / 2 - (businessNameLines.length * 70) / 2;
      drawMultilineText(ctx, businessNameLines, centerX, nameStartY, size === 'a4' ? 130 : 100);
      ctx.shadowBlur = 0;

      // Bio/tagline under header
      if (professional.bio) {
        const bioY = headerHeight + 150;
        ctx.font = `${size === 'a4' ? '48' : '38'}px Arial`;
        ctx.fillStyle = colorScheme.primary;
        ctx.textAlign = 'center';
        const bioLines = wrapText(ctx, professional.bio, canvas.width - 300);
        drawMultilineText(ctx, bioLines.slice(0, 3), centerX, bioY, size === 'a4' ? 60 : 50);
      }

      // Custom headline
      const headlineY = headerHeight + (professional.bio ? 350 : 200);
      ctx.font = `bold ${size === 'a4' ? '64' : '52'}px Arial`;
      ctx.fillStyle = colorScheme.secondary;
      const headlineLines = wrapText(ctx, customHeadline, canvas.width - 200);
      drawMultilineText(ctx, headlineLines, centerX, headlineY, size === 'a4' ? 75 : 60);

      // QR Code - center of flyer
      const qrSize = size === 'a4' ? 600 : 450;
      const qrDataUrl = await generateQRDataURL(bookingUrl, {
        color: colorScheme.primary,
        size: qrSize,
      });

      const qrImg = new Image();
      qrImg.onload = () => {
        const qrY = canvas.height / 2 - qrSize / 2 + 150;

        // White rounded background
        const bgPadding = 40;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.roundRect(
          centerX - qrSize / 2 - bgPadding,
          qrY - bgPadding,
          qrSize + bgPadding * 2,
          qrSize + bgPadding * 2,
          30
        );
        ctx.fill();
        ctx.shadowBlur = 0;

        // Draw QR
        ctx.drawImage(qrImg, centerX - qrSize / 2, qrY, qrSize, qrSize);

        // "Scan to book" text
        ctx.font = `bold ${size === 'a4' ? '56' : '44'}px Arial`;
        ctx.fillStyle = colorScheme.primary;
        ctx.textAlign = 'center';
        ctx.fillText('Escaneie para agendar', centerX, qrY + qrSize + 100);

        // Custom description
        if (customDescription) {
          const descY = qrY + qrSize + 200;
          ctx.font = `${size === 'a4' ? '40' : '32'}px Arial`;
          ctx.fillStyle = '#374151';
          const descLines = wrapText(ctx, customDescription, canvas.width - 400);
          drawMultilineText(ctx, descLines.slice(0, 2), centerX, descY, size === 'a4' ? 50 : 40);
        }

        // Footer section
        const footerY = canvas.height - 300;

        // URL
        ctx.font = `bold ${size === 'a4' ? '48' : '38'}px monospace`;
        ctx.fillStyle = colorScheme.primary;
        const shortUrl = `circlehood.app/${professional.slug}`;
        ctx.fillText(shortUrl, centerX, footerY);

        // Phone (if enabled)
        if (showPhone && professional.phone) {
          ctx.font = `${size === 'a4' ? '44' : '34'}px Arial`;
          ctx.fillStyle = '#6B7280';
          ctx.fillText(`📱 ${professional.phone}`, centerX, footerY + (size === 'a4' ? 70 : 55));
        }

        // Decorative line
        ctx.strokeStyle = colorScheme.secondary;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(canvas.width * 0.3, footerY - 100);
        ctx.lineTo(canvas.width * 0.7, footerY - 100);
        ctx.stroke();

        setPreviewUrl(canvas.toDataURL());
      };
      qrImg.src = qrDataUrl;

    } catch (error) {
      console.error('Error generating flyer:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao gerar flyer',
        variant: 'destructive',
      });
    }
  }

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    try {
      const filename = `flyer-${size}-${professional.slug}`;
      canvasToPNG(canvas, filename);

      toast({
        title: 'Sucesso!',
        description: `Flyer ${FLYER_SIZES[size].label} baixado com sucesso`,
      });
    } catch (error) {
      console.error('Error downloading flyer:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao baixar flyer',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePrint() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      printCanvas(canvas);
      toast({
        title: 'Imprimindo...',
        description: 'Janela de impressão aberta',
      });
    } catch (error) {
      console.error('Error printing flyer:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao imprimir flyer',
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Preview */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Preview</h4>
              <span className="text-xs text-muted-foreground">
                {FLYER_SIZES[size].label} @ 300dpi
              </span>
            </div>

            {/* Size Selector */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={size === 'a4' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSize('a4')}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                A4
              </Button>
              <Button
                variant={size === 'a5' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSize('a5')}
                className="gap-2"
              >
                <FileText className="h-4 w-4" />
                A5
              </Button>
            </div>

            {/* Flyer Preview */}
            <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[400px]">
              {previewUrl ? (
                <div className="shadow-2xl rounded-lg overflow-hidden max-w-[300px]">
                  <img
                    src={previewUrl}
                    alt="Flyer Preview"
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <p className="text-muted-foreground">Gerando preview...</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={handleDownload}
                disabled={loading || !previewUrl}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar
              </Button>
              <Button
                onClick={handlePrint}
                disabled={loading || !previewUrl}
                variant="outline"
                className="w-full"
              >
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Alta resolução ({FLYER_SIZES[size].width}x{FLYER_SIZES[size].height}px @ 300dpi)
              <br />
              Pronto para impressão profissional
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Customization */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">Personalização</h4>

              {/* Color Scheme */}
              <div className="space-y-2 mb-4">
                <Label>Esquema de Cores</Label>
                <div className="grid grid-cols-2 gap-2">
                  {COLOR_SCHEMES.map((scheme) => (
                    <Button
                      key={scheme.label}
                      variant={colorScheme === scheme ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setColorScheme(scheme)}
                      className="justify-start gap-2"
                    >
                      <div className="flex gap-1">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: scheme.primary }}
                        />
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: scheme.secondary }}
                        />
                      </div>
                      {scheme.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Headline */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="headline">Título de Chamada</Label>
                <Input
                  id="headline"
                  value={customHeadline}
                  onChange={(e) => setCustomHeadline(e.target.value)}
                  placeholder="Agende seu horário agora!"
                  maxLength={60}
                />
              </div>

              {/* Custom Description */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Adicione informações extras..."
                  rows={3}
                  maxLength={150}
                />
              </div>

              {/* Show Phone */}
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  id="show-phone"
                  checked={showPhone}
                  onChange={(e) => setShowPhone(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="show-phone" className="cursor-pointer">
                  Mostrar telefone no flyer
                </Label>
              </div>
            </div>

            {/* Tips */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 text-sm">💡 Dicas de Impressão</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Use papel couché 170g ou superior</li>
                <li>• Imprima em gráfica para melhor qualidade</li>
                <li>• A4: ideal para murais e vitrines</li>
                <li>• A5: perfeito para distribuição manual</li>
                <li>• Plastifique para maior durabilidade</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
