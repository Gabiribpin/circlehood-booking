'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Download, Instagram, Facebook } from 'lucide-react';
import { generateQRDataURL } from '@/lib/marketing/qr-generator';
import { canvasToPNG } from '@/lib/marketing/export-utils';
import { drawGradientBackground, wrapText, drawMultilineText } from '@/lib/marketing/canvas-utils';
import { useToast } from '@/hooks/use-toast';

interface SocialPostGeneratorProps {
  professional: any;
  bookingUrl: string;
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

export function SocialPostGenerator({ professional, bookingUrl }: SocialPostGeneratorProps) {
  const [format, setFormat] = useState<PostFormat>('instagram-story');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [theme, setTheme] = useState(GRADIENT_THEMES[0]);
  const [customTitle, setCustomTitle] = useState('Agende Comigo!');
  const [customMessage, setCustomMessage] = useState('Acesse o link e escolha o melhor horário para você 📅');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    generatePreview();
  }, [format, theme, customTitle, customMessage]);

  async function generatePreview() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dimensions = POST_FORMATS[format];
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    try {
      // Background gradient
      drawGradientBackground(ctx, canvas.width, canvas.height, theme.color1, theme.color2, 'diagonal');

      // QR Code
      const qrSize = format === 'instagram-story' ? 300 : 250;
      const qrDataUrl = await generateQRDataURL(bookingUrl, {
        color: '#000000',
        size: qrSize,
      });

      const qrImg = new Image();
      qrImg.onload = () => {
        // Calculate positions
        const centerX = canvas.width / 2;
        const qrY = format === 'instagram-story'
          ? canvas.height / 2 - qrSize / 2 + 100
          : canvas.height / 2 - qrSize / 2 + 50;

        // White rounded background for QR
        const bgPadding = 30;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.roundRect(
          centerX - qrSize / 2 - bgPadding,
          qrY - bgPadding,
          qrSize + bgPadding * 2,
          qrSize + bgPadding * 2,
          20
        );
        ctx.fill();

        // Draw QR
        ctx.drawImage(qrImg, centerX - qrSize / 2, qrY, qrSize, qrSize);

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

        // Custom message below QR
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
        const shortUrl = `circlehood.app/${professional.slug}`;
        ctx.fillText(shortUrl, centerX, bottomY);

        // Call to action
        ctx.font = '24px Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillText('👆 Toque para agendar', centerX, bottomY + 40);

        setPreviewUrl(canvas.toDataURL());
      };
      qrImg.src = qrDataUrl;

    } catch (error) {
      console.error('Error generating social post:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao gerar post',
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
        title: 'Sucesso!',
        description: `Post para ${POST_FORMATS[format].label} baixado com sucesso`,
      });
    } catch (error) {
      console.error('Error downloading post:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao baixar post',
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
              <span className="text-xs text-muted-foreground">
                {POST_FORMATS[format].width}x{POST_FORMATS[format].height}px
              </span>
            </div>

            {/* Format Selector */}
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

            {/* Post Preview */}
            <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[400px]">
              {previewUrl ? (
                <div
                  className={`shadow-2xl rounded-lg overflow-hidden ${
                    format === 'instagram-story' ? 'max-w-[250px]' : 'max-w-[300px]'
                  }`}
                >
                  <img
                    src={previewUrl}
                    alt="Social Post Preview"
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
              Baixar {POST_FORMATS[format].label}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Customization */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">Personalização</h4>

              {/* Theme Selection */}
              <div className="space-y-2 mb-4">
                <Label>Tema de Cores</Label>
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

              {/* Custom Title */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="title">Título Principal</Label>
                <Input
                  id="title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="Agende Comigo!"
                  maxLength={50}
                />
              </div>

              {/* Custom Message */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="message">Mensagem</Label>
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
            </div>

            {/* Tips */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 text-sm">💡 Dicas</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• Instagram Stories: ideal para engajamento rápido</li>
                <li>• Facebook Post: melhor para feeds e compartilhamentos</li>
                <li>• Poste regularmente para manter audiência engajada</li>
                <li>• Use hashtags relevantes ao seu negócio</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
