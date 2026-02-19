'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Share2,
  Megaphone,
  QrCode,
  MessageSquare,
  Copy,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Download,
} from 'lucide-react';
import QRCode from 'qrcode';

export function NextStepsCard() {
  const [copied, setCopied] = useState<'landing' | 'whatsapp' | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [landingUrl, setLandingUrl] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: professional }, { data: whatsappConfig }] = await Promise.all([
        supabase.from('professionals').select('slug, business_name').eq('user_id', user.id).single(),
        supabase.from('whatsapp_config').select('business_phone, is_active').eq('user_id', user.id).maybeSingle(),
      ]);

      if (professional?.slug) {
        const url = `${window.location.origin}/${professional.slug}`;
        setLandingUrl(url);
        setSlug(professional.slug);
        setBusinessName(professional.business_name ?? '');

        QRCode.toDataURL(url, { width: 200, margin: 2 }).then(setQrCodeUrl);
      }

      if (whatsappConfig?.business_phone) {
        setWhatsappNumber(whatsappConfig.business_phone);
      }
    }
    fetchData();
  }, []);

  function copyToClipboard(text: string, type: 'landing' | 'whatsapp') {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleDownloadQR() {
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
    <Card className="p-6 bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200">
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2 bg-green-100 rounded-lg shrink-0">
          <Sparkles className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-green-900">
            Parabéns! Você está pronto para receber clientes!
          </h2>
          <p className="text-gray-600 mt-1">
            Agora é hora de divulgar e começar a lotar sua agenda
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Passo 1: Criar Artes */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-sm">1. Crie artes de divulgação</h3>
            </div>
            <Badge variant="secondary" className="text-xs">Recomendado</Badge>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Posts profissionais para Instagram, Stories e WhatsApp Status
          </p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => { window.location.href = '/marketing'; }}
          >
            <Megaphone className="w-4 h-4 mr-2" />
            Ir para Marketing
          </Button>
        </div>

        {/* Passo 2: Compartilhar Landing Page */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-sm">2. Compartilhe sua página</h3>
            </div>
            <Badge variant="secondary" className="text-xs">Essencial</Badge>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Link personalizado para clientes agendarem online 24/7
          </p>

          {landingUrl && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={landingUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-xs border rounded-lg bg-gray-50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => copyToClipboard(landingUrl, 'landing')}
                >
                  {copied === 'landing'
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <Copy className="w-4 h-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => window.open(landingUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>

              {qrCodeUrl && (
                <div className="flex items-center gap-3 pt-1">
                  <div className="p-2 bg-white rounded border">
                    <img src={qrCodeUrl} alt="QR Code" className="w-16 h-16" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={handleDownloadQR}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Baixar QR Code
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        const msg = `Agende seu horário comigo! ✨\n\n${landingUrl}`;
                        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      Compartilhar no WhatsApp
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Passo 3: WhatsApp Bot */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              <h3 className="font-semibold text-sm">3. Divulgue seu WhatsApp Bot</h3>
            </div>
            <Badge variant="secondary" className="text-xs">Importante</Badge>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Clientes podem agendar direto pelo WhatsApp — sem você precisar responder
          </p>

          {whatsappNumber ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={whatsappNumber}
                  readOnly
                  className="flex-1 px-3 py-2 text-xs border rounded-lg bg-gray-50"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => copyToClipboard(whatsappNumber, 'whatsapp')}
                >
                  {copied === 'whatsapp'
                    ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                    : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const msg = `Manda uma mensagem pra mim no WhatsApp para agendar! 💇✨\n\nWhatsApp: ${whatsappNumber}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                }}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar número do bot
              </Button>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800 mb-2">
                WhatsApp Bot não conectado ainda
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { window.location.href = '/whatsapp-config'; }}
              >
                Configurar WhatsApp
              </Button>
            </div>
          )}
        </div>

        {/* Dicas */}
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-2">
            Onde compartilhar?
          </p>
          <ul className="text-xs text-blue-800 space-y-1">
            <li>• Instagram Bio e Stories</li>
            <li>• Facebook e WhatsApp Status</li>
            <li>• Google Meu Negócio</li>
            <li>• Grupos de WhatsApp da sua região</li>
            <li>• Imprima o QR Code e cole no seu estabelecimento</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
