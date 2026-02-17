'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, RefreshCw } from 'lucide-react';
import { generateQRDataURL } from '@/lib/marketing/qr-generator';
import { canvasToPNG } from '@/lib/marketing/export-utils';
import { drawGradientBackground, wrapText, drawMultilineText } from '@/lib/marketing/canvas-utils';
import { useToast } from '@/hooks/use-toast';

interface BusinessCardGeneratorProps {
  professional: any;
  bookingUrl: string;
}

const CARD_WIDTH = 1050; // 3.5" at 300 DPI
const CARD_HEIGHT = 600; // 2" at 300 DPI

const GRADIENT_PRESETS = [
  { label: 'Azul', color1: '#2563EB', color2: '#1E40AF' },
  { label: 'Roxo', color1: '#7C3AED', color2: '#5B21B6' },
  { label: 'Verde', color1: '#059669', color2: '#047857' },
  { label: 'Rosa', color1: '#DB2777', color2: '#BE185D' },
  { label: 'Laranja', color1: '#EA580C', color2: '#C2410C' },
];

export function BusinessCardGenerator({ professional, bookingUrl }: BusinessCardGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [gradient, setGradient] = useState(GRADIENT_PRESETS[0]);
  const [customPhone, setCustomPhone] = useState(professional.phone || '');
  const [customInstagram, setCustomInstagram] = useState(professional.instagram || '');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    generatePreview();
  }, [gradient, customPhone, customInstagram]);

  async function generatePreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    try {
      // Background gradient
      drawGradientBackground(ctx, CARD_WIDTH, CARD_HEIGHT, gradient.color1, gradient.color2, 'diagonal');

      // Generate QR code
      const qrSize = 220;
      const qrDataUrl = await generateQRDataURL(bookingUrl, {
        color: '#000000',
        size: qrSize,
      });

      // Draw QR code on right side with white background
      const qrPadding = 40;
      const qrX = CARD_WIDTH - qrSize - qrPadding - 20;
      const qrY = (CARD_HEIGHT - qrSize - 60) / 2;

      // White rounded background for QR
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 80, 15);
      ctx.fill();

      // Draw QR code
      const qrImg = new Image();
      qrImg.onload = () => {
        ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

        // "Scan to book" text below QR
        ctx.fillStyle = '#666666';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Escaneie para agendar', qrX + qrSize / 2, qrY + qrSize + 40);

        // Set preview
        setPreviewUrl(canvas.toDataURL());
      };
      qrImg.src = qrDataUrl;

      // Left side - Business info
      const leftPadding = 50;
      const topPadding = 80;

      // Business name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 42px Arial';
      ctx.textAlign = 'left';
      const nameLines = wrapText(ctx, professional.business_name, 450);
      drawMultilineText(ctx, nameLines, leftPadding, topPadding, 50);

      // Bio
      if (professional.bio) {
        ctx.font = '18px Arial';
        ctx.fillStyle = '#F0F0F0';
        const bioLines = wrapText(ctx, professional.bio, 450);
        drawMultilineText(ctx, bioLines.slice(0, 3), leftPadding, topPadding + (nameLines.length * 50) + 30, 28);
      }

      // Contact info
      const contactY = CARD_HEIGHT - 120;
      ctx.font = '20px Arial';
      ctx.fillStyle = '#FFFFFF';

      if (customPhone) {
        ctx.fillText(`📱 ${customPhone}`, leftPadding, contactY);
      }

      if (customInstagram) {
        ctx.fillText(`📷 @${customInstagram.replace('@', '')}`, leftPadding, contactY + 35);
      }

      // Short URL
      ctx.font = '16px monospace';
      ctx.fillStyle = '#E0E0E0';
      const shortUrl = `circlehood.app/${professional.slug}`;
      ctx.fillText(shortUrl, leftPadding, contactY + 75);

    } catch (error) {
      console.error('Error generating business card:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao gerar cartão de visita',
        variant: 'destructive',
      });
    }
  }

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    try {
      canvasToPNG(canvas, `cartao-${professional.slug}`);

      toast({
        title: 'Sucesso!',
        description: 'Cartão de visita baixado com sucesso',
      });
    } catch (error) {
      console.error('Error downloading card:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao baixar cartão',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
              <span className="text-xs text-muted-foreground">1050x600px</span>
            </div>

            {/* Card Preview */}
            <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[300px]">
              {previewUrl ? (
                <div className="w-full max-w-md shadow-2xl rounded-lg overflow-hidden">
                  <img
                    src={previewUrl}
                    alt="Business Card Preview"
                    className="w-full h-auto"
                  />
                </div>
              ) : (
                <p className="text-muted-foreground">Gerando preview...</p>
              )}
            </div>

            {/* Download Button */}
            <Button
              onClick={handleDownload}
              disabled={loading || !previewUrl}
              className="w-full"
              size="lg"
            >
              <Download className="mr-2 h-4 w-4" />
              Baixar Cartão (PNG)
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Alta resolução (1050x600px) • Perfeito para compartilhar em redes sociais
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

              {/* Gradient Selection */}
              <div className="space-y-2 mb-4">
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
                      <div
                        className="w-4 h-4 rounded"
                        style={{
                          background: `linear-gradient(135deg, ${preset.color1}, ${preset.color2})`,
                        }}
                      />
                      {preset.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Phone */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="phone">Telefone (opcional)</Label>
                <Input
                  id="phone"
                  value={customPhone}
                  onChange={(e) => setCustomPhone(e.target.value)}
                  placeholder="+351 91 234 5678"
                />
              </div>

              {/* Custom Instagram */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="instagram">Instagram (opcional)</Label>
                <Input
                  id="instagram"
                  value={customInstagram}
                  onChange={(e) => setCustomInstagram(e.target.value)}
                  placeholder="@seunegocio"
                />
              </div>

              {/* Regenerate Button */}
              <Button
                onClick={generatePreview}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Preview
              </Button>
            </div>

            {/* Info */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 text-sm">💡 Dica</h4>
              <p className="text-xs text-muted-foreground">
                Use este cartão digital para compartilhar no WhatsApp, Instagram Stories, ou como imagem de perfil em grupos.
                Clientes podem escanear o QR code para agendar diretamente!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
