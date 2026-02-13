'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Download, Check, Share2 } from 'lucide-react';
import QRCode from 'qrcode';

interface ShareLinkCardProps {
  slug: string;
  businessName: string;
}

export function ShareLinkCard({ slug, businessName }: ShareLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fullUrl = `https://circlehood-booking.vercel.app/${slug}`;

  useEffect(() => {
    // Generate QR code
    QRCode.toDataURL(fullUrl, {
      width: 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    }).then(setQrCodeUrl);
  }, [fullUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  async function handleDownloadQR() {
    if (!qrCodeUrl) return;

    // Create a canvas with extra space for text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 350;

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw QR code
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 50, 30, 200, 200);

      // Add text below QR code
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(businessName, canvas.width / 2, 260);

      ctx.font = '14px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText('Escaneie para agendar', canvas.width / 2, 285);

      ctx.font = '12px monospace';
      ctx.fillStyle = '#999999';
      const shortUrl = `circlehood.app/${slug}`;
      ctx.fillText(shortUrl, canvas.width / 2, 310);

      // Download
      const link = document.createElement('a');
      link.download = `qrcode-${slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = qrCodeUrl;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Share2 className="h-4 w-4" />
          Compartilhe sua página
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Link */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Seu link:</p>
          <div className="flex gap-2">
            <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md break-all">
              {fullUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className="shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          {copied && (
            <p className="text-xs text-green-600 dark:text-green-400">
              ✓ Link copiado!
            </p>
          )}
        </div>

        {/* QR Code */}
        <div className="space-y-2">
          <p className="text-sm font-medium">QR Code:</p>
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {qrCodeUrl && (
              <div className="p-3 bg-white rounded-lg border">
                <img
                  src={qrCodeUrl}
                  alt="QR Code"
                  className="w-32 h-32"
                />
              </div>
            )}
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">
                Clientes podem escanear para agendar direto no celular
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadQR}
                className="w-full sm:w-auto"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar QR Code
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
