'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, Copy, Check, Save } from 'lucide-react';
import { generateQRDataURL } from '@/lib/marketing/qr-generator';
import { canvasToPNG, canvasToSVG } from '@/lib/marketing/export-utils';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';

interface QRGeneratorProps {
  url: string;
  professionalId: string;
  businessName: string;
}

const QR_SIZES = [
  { label: '200px (Preview)', value: 200 },
  { label: '300px (Email)', value: 300 },
  { label: '500px (Web)', value: 500 },
  { label: '1000px (Impressão)', value: 1000 },
];

const PRESET_COLORS = [
  { label: 'Preto', value: '#000000' },
  { label: 'Azul', value: '#2563EB' },
  { label: 'Roxo', value: '#7C3AED' },
  { label: 'Verde', value: '#059669' },
  { label: 'Vermelho', value: '#DC2626' },
  { label: 'Rosa', value: '#DB2777' },
];

export function QRGenerator({ url, professionalId, businessName }: QRGeneratorProps) {
  const [qrColor, setQrColor] = useState('#000000');
  const [qrSize, setQrSize] = useState(300);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveName, setSaveName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

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
      console.error('Error generating QR preview:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao gerar preview do QR code',
        variant: 'destructive',
      });
    }
  }

  async function handleDownloadPNG() {
    if (!qrCodeUrl) return;

    setLoading(true);
    try {
      // Create canvas with QR code and business name
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const padding = 50;
      const textHeight = 100;
      canvas.width = qrSize + (padding * 2);
      canvas.height = qrSize + textHeight + (padding * 2);

      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw QR code
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, padding, padding, qrSize, qrSize);

        // Add business name
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(businessName, canvas.width / 2, qrSize + padding + 40);

        // Add instruction text
        ctx.font = '18px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText('Escaneie para agendar', canvas.width / 2, qrSize + padding + 70);

        // Download
        canvasToPNG(canvas, `qrcode-${businessName.toLowerCase().replace(/\s+/g, '-')}`);

        toast({
          title: 'Sucesso!',
          description: 'QR Code baixado com sucesso',
        });
      };
      img.src = qrCodeUrl;
    } catch (error) {
      console.error('Error downloading QR:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao baixar QR code',
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
        canvasToSVG(canvas, `qrcode-${businessName.toLowerCase().replace(/\s+/g, '-')}`);

        toast({
          title: 'Sucesso!',
          description: 'QR Code SVG baixado com sucesso',
        });
      };
      img.src = qrCodeUrl;
    } catch (error) {
      console.error('Error downloading SVG:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao baixar QR code SVG',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyToClipboard() {
    if (!qrCodeUrl) return;

    try {
      // Convert data URL to blob
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();

      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      toast({
        title: 'Copiado!',
        description: 'QR Code copiado para área de transferência',
      });
    } catch (error) {
      console.error('Error copying QR:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao copiar QR code',
        variant: 'destructive',
      });
    }
  }

  async function handleSaveDesign() {
    if (!saveName.trim()) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite um nome para salvar o design',
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
        title: 'Salvo!',
        description: 'Design do QR Code salvo com sucesso',
      });

      setSaveName('');
    } catch (error) {
      console.error('Error saving QR design:', error);
      toast({
        title: 'Erro',
        description: 'Falha ao salvar design',
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
              <span className="text-xs text-muted-foreground">{qrSize}x{qrSize}px</span>
            </div>

            {/* QR Code Preview */}
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
                <p className="text-muted-foreground">Gerando preview...</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleDownloadPNG}
                disabled={loading || !qrCodeUrl}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar PNG
              </Button>
              <Button
                onClick={handleDownloadSVG}
                disabled={loading || !qrCodeUrl}
                variant="outline"
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Baixar SVG
              </Button>
              <Button
                onClick={handleCopyToClipboard}
                disabled={loading || !qrCodeUrl}
                variant="outline"
                size="icon"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customization */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              <h4 className="font-medium mb-4">Personalização</h4>

              {/* Size Selection */}
              <div className="space-y-2 mb-4">
                <Label>Tamanho</Label>
                <div className="grid grid-cols-2 gap-2">
                  {QR_SIZES.map((size) => (
                    <Button
                      key={size.value}
                      variant={qrSize === size.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setQrSize(size.value)}
                      className="justify-start"
                    >
                      {size.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Color Selection */}
              <div className="space-y-2 mb-4">
                <Label>Cor</Label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_COLORS.map((color) => (
                    <Button
                      key={color.value}
                      variant={qrColor === color.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setQrColor(color.value)}
                      className="justify-start gap-2"
                    >
                      <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: color.value }}
                      />
                      {color.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Color Picker */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="custom-color">Cor Personalizada</Label>
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
            </div>

            {/* Save Design */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Salvar Design</h4>
              <div className="space-y-2">
                <Label htmlFor="save-name">Nome do design</Label>
                <div className="flex gap-2">
                  <Input
                    id="save-name"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Ex: QR Code Principal"
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
                  Salve seus designs favoritos para reutilizar depois
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}
