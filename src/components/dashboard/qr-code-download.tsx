'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

interface QrCodeDownloadProps {
  slug: string;
  businessName: string;
}

export function QrCodeDownload({ slug, businessName }: QrCodeDownloadProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const fullUrl = `https://circlehood-booking.vercel.app/${slug}`;

  useEffect(() => {
    QRCode.toDataURL(fullUrl, { width: 200, margin: 2 }).then(setQrCodeUrl);
  }, [fullUrl]);

  async function handleDownload() {
    if (!qrCodeUrl) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 300;
    canvas.height = 350;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 50, 30, 200, 200);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(businessName, canvas.width / 2, 260);
      ctx.font = '14px Arial';
      ctx.fillStyle = '#666666';
      ctx.fillText('Escaneie para agendar', canvas.width / 2, 285);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#999999';
      ctx.fillText(`circlehood.app/${slug}`, canvas.width / 2, 310);

      const link = document.createElement('a');
      link.download = `qrcode-${slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = qrCodeUrl;
  }

  return (
    <div className="flex items-center justify-between p-4 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center gap-3">
        {qrCodeUrl && (
          <div className="p-1 bg-white rounded border">
            <img src={qrCodeUrl} alt="QR Code" className="w-12 h-12" />
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-blue-900">QR Code da sua página</p>
          <p className="text-xs text-blue-700">Cole no seu estabelecimento ou compartilhe nas redes</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={handleDownload} disabled={!qrCodeUrl}>
        <Download className="w-4 h-4 mr-2" />
        Baixar
      </Button>
    </div>
  );
}
