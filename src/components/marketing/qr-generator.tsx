'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, Save } from 'lucide-react';
import { ImageShareButtons } from '@/components/marketing/image-share-buttons';
import { generateQRDataURL } from '@/lib/marketing/qr-generator';
import { canvasToPNG, canvasToSVG } from '@/lib/marketing/export-utils';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

interface QRGeneratorProps {
  url: string;
  professionalId: string;
  businessName: string;
  whatsappPhone?: string | null;
  renderMode?: 'customize' | 'actions';
}

const QR_SIZES = [
  { label: '200px (Preview)', value: 200 },
  { label: '300px (Email)', value: 300 },
  { label: '500px (Web)', value: 500 },
  { label: '1000px (Print)', value: 1000 },
];

const PRESET_COLORS = [
  { label: 'Preto', value: '#000000' },
  { label: 'Azul', value: '#2563EB' },
  { label: 'Roxo', value: '#7C3AED' },
  { label: 'Verde', value: '#059669' },
  { label: 'Vermelho', value: '#DC2626' },
  { label: 'Rosa', value: '#DB2777' },
];

export function QRGenerator({ url, professionalId, businessName, renderMode }: QRGeneratorProps) {
  const t = useTranslations('marketing');
  const [qrColor, setQrColor] = useState('#000000');
  const [qrSize, setQrSize] = useState(300);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const ctaText = url.includes('wa.me') ? t('ctaWhatsapp') : t('ctaBooking');

  // Generate QR code preview
  useEffect(() => {
    generatePreview();
  }, [qrColor, qrSize, url]);

  async function generatePreview() {
    try {
      const dataUrl = await generateQRDataURL(url, {
        color: qrColor,
        size: qrSize,
      });
      setQrCodeUrl(dataUrl);
    } catch (error) {
      logger.error('Error generating QR preview:', error);
      toast({
        title: t('toastError'),
        description: t('toastQrFailed'),
        variant: 'destructive',
      });
    }
  }

  async function handleDownloadPNG() {
    if (!qrCodeUrl) return;

    setLoading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const padding = 50;
      const textHeight = 100;
      canvas.width = qrSize + (padding * 2);
      canvas.height = qrSize + textHeight + (padding * 2);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding, qrSize, qrSize);

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(businessName, canvas.width / 2, qrSize + padding + 40);

        ctx.font = '18px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText(ctaText, canvas.width / 2, qrSize + padding + 70);

        const isWhatsapp = url.includes('wa.me');
        canvasToPNG(canvas, `qrcode-${isWhatsapp ? 'whatsapp-' : ''}${businessName.toLowerCase().replace(/\s+/g, '-')}`);

        toast({
          title: t('toastSuccess'),
          description: t('toastQrDownloaded'),
        });
      };
      img.src = qrCodeUrl;
    } catch (error) {
      logger.error('Error downloading QR:', error);
      toast({
        title: t('toastError'),
        description: t('toastQrDownloadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadSVG() {
    if (!qrCodeUrl) return;

    setLoading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      canvas.width = qrSize;
      canvas.height = qrSize;

      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        const isWhatsapp = url.includes('wa.me');
        canvasToSVG(canvas, `qrcode-${isWhatsapp ? 'whatsapp-' : ''}${businessName.toLowerCase().replace(/\s+/g, '-')}`);

        toast({
          title: t('toastSuccess'),
          description: t('toastQrSvgDownloaded'),
        });
      };
      img.src = qrCodeUrl;
    } catch (error) {
      logger.error('Error downloading SVG:', error);
      toast({
        title: t('toastError'),
        description: t('toastQrDownloadFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function getQRBlob(): Promise<Blob | null> {
    if (!qrCodeUrl) return null;
    const res = await fetch(qrCodeUrl);
    return res.blob();
  }

  async function handleSaveDesign() {
    if (!saveName.trim()) {
      toast({
        title: t('toastQrSaveNameRequired'),
        description: t('toastQrSaveNameHint'),
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();

      const config = {
        color: qrColor,
        size: qrSize,
        logoEnabled: false,
      };

      const { error } = await supabase
        .from('qr_codes')
        .insert({
          professional_id: professionalId,
          name: saveName,
          config,
          image_url: qrCodeUrl,
        });

      if (error) throw error;

      toast({
        title: t('toastSaved'),
        description: t('toastQrSaved'),
      });

      setSaveName('');
    } catch (error) {
      logger.error('Error saving QR design:', error);
      toast({
        title: t('toastError'),
        description: t('toastQrSaveFailed'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  // Customize-only mode: just customization controls
  if (renderMode === 'customize') {
    return (
      <div className="space-y-6">
        {/* Preview */}
        <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
          {qrCodeUrl ? (
            <div className="bg-white p-3 rounded-lg shadow-lg">
              <img
                src={qrCodeUrl}
                alt="QR Code Preview"
                className="w-full h-auto"
                style={{ maxWidth: '250px' }}
              />
            </div>
          ) : (
            <p className="text-muted-foreground">{t('generatingPreview')}</p>
          )}
        </div>

        {/* Size Selection */}
        <div className="space-y-2">
          <Label>{t('qrSizeLabel')}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QR_SIZES.map((size) => (
              <Button
                key={size.value}
                variant={qrSize === size.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQrSize(size.value)}
                className="text-xs"
              >
                {size.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Color Selection */}
        <div className="space-y-2">
          <Label>{t('qrColorLabel')}</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {PRESET_COLORS.map((color) => (
              <Button
                key={color.value}
                variant={qrColor === color.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setQrColor(color.value)}
                className="justify-start gap-2"
              >
                <div
                  className="w-4 h-4 rounded border shrink-0"
                  style={{ backgroundColor: color.value }}
                />
                {color.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Custom Color Picker */}
        <div className="space-y-2">
          <Label htmlFor="custom-color">{t('qrCustomColor')}</Label>
          <div className="flex gap-2">
            <Input
              id="custom-color"
              type="color"
              value={qrColor}
              onChange={(e) => setQrColor(e.target.value)}
              className="w-20 h-10"
            />
            <Input
              type="text"
              value={qrColor}
              onChange={(e) => setQrColor(e.target.value)}
              placeholder="#000000"
              className="flex-1 font-mono"
            />
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  // Actions-only mode: preview + download/share/save
  if (renderMode === 'actions') {
    return (
      <div className="space-y-4">
        {/* Large Preview */}
        <div className="flex items-center justify-center p-8 bg-muted rounded-lg min-h-[300px]">
          {qrCodeUrl ? (
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <img
                src={qrCodeUrl}
                alt="QR Code Preview"
                className="w-full h-auto"
                style={{ maxWidth: '300px' }}
              />
            </div>
          ) : (
            <p className="text-muted-foreground">{t('generatingPreview')}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <Button
            onClick={handleDownloadPNG}
            disabled={loading || !qrCodeUrl}
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            {t('qrDownloadPNG')}
          </Button>
          <Button
            onClick={handleDownloadSVG}
            disabled={loading || !qrCodeUrl}
            variant="outline"
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            {t('qrDownloadSVG')}
          </Button>
          <ImageShareButtons
            getBlob={getQRBlob}
            filename={`qrcode-${url.includes('wa.me') ? 'whatsapp-' : ''}${businessName.toLowerCase().replace(/\s+/g, '-')}`}
          />
        </div>

        {/* Save Design */}
        <div className="border-t pt-4">
          <h4 className="font-medium mb-4">{t('qrSaveDesign')}</h4>
          <div className="space-y-2">
            <Label htmlFor="save-name">{t('qrSaveName')}</Label>
            <div className="flex gap-2">
              <Input
                id="save-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder={t('qrSaveNamePlaceholder')}
              />
              <Button
                onClick={handleSaveDesign}
                disabled={loading || !saveName.trim()}
                size="icon"
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('qrSaveHint')}
            </p>
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    );
  }

  // Default mode: full layout (backward compat)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview */}
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Preview</h4>
                <span className="text-xs text-muted-foreground">{qrSize}x{qrSize}px</span>
              </div>

              <div className="flex items-center justify-center p-8 bg-muted rounded-lg min-h-[300px]">
                {qrCodeUrl ? (
                  <div className="bg-white p-4 rounded-lg shadow-lg">
                    <img
                      src={qrCodeUrl}
                      alt="QR Code Preview"
                      className="w-full h-auto"
                      style={{ maxWidth: '300px' }}
                    />
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('generatingPreview')}</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <Button
                  onClick={handleDownloadPNG}
                  disabled={loading || !qrCodeUrl}
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('qrDownloadPNG')}
                </Button>
                <Button
                  onClick={handleDownloadSVG}
                  disabled={loading || !qrCodeUrl}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t('qrDownloadSVG')}
                </Button>
                <ImageShareButtons
                  getBlob={getQRBlob}
                  filename={`qrcode-${businessName.toLowerCase().replace(/\s+/g, '-')}`}
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
                  <Label>{t('qrSizeLabel')}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {QR_SIZES.map((size) => (
                      <Button
                        key={size.value}
                        variant={qrSize === size.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setQrSize(size.value)}
                        className="text-xs"
                      >
                        {size.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <Label>{t('qrColorLabel')}</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {PRESET_COLORS.map((color) => (
                      <Button
                        key={color.value}
                        variant={qrColor === color.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setQrColor(color.value)}
                        className="justify-start gap-2"
                      >
                        <div
                          className="w-4 h-4 rounded border shrink-0"
                          style={{ backgroundColor: color.value }}
                        />
                        {color.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <Label htmlFor="custom-color-default">{t('qrCustomColor')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="custom-color-default"
                      type="color"
                      value={qrColor}
                      onChange={(e) => setQrColor(e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={qrColor}
                      onChange={(e) => setQrColor(e.target.value)}
                      placeholder="#000000"
                      className="flex-1 font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">{t('qrSaveDesign')}</h4>
                <div className="space-y-2">
                  <Label htmlFor="save-name-default">{t('qrSaveName')}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="save-name-default"
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder={t('qrSaveNamePlaceholder')}
                    />
                    <Button
                      onClick={handleSaveDesign}
                      disabled={loading || !saveName.trim()}
                      size="icon"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('qrSaveHint')}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
