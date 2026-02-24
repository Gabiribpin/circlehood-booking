'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, Instagram, Copy, Check, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageShareButtonsProps {
  /** Called fresh on each share action — returns the PNG blob to share. */
  getBlob: () => Promise<Blob | null>;
  /** Base filename (without extension) used for downloads. */
  filename?: string;
  className?: string;
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ImageShareButtons({ getBlob, filename = 'imagem', className }: ImageShareButtonsProps) {
  const [loading, setLoading] = useState<'whatsapp' | 'instagram' | 'copy' | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  async function handleWhatsApp() {
    setLoading('whatsapp');
    try {
      const blob = await getBlob();
      if (!blob) return;

      const file = new File([blob], `${filename}.png`, { type: 'image/png' });

      if (navigator.canShare?.({ files: [file] })) {
        // Native share sheet opens with the image attached (mobile/desktop Chrome/Safari)
        await navigator.share({ files: [file] });
      } else {
        // Fallback: download + show instruction
        triggerDownload(blob, filename);
        toast({
          title: 'Imagem baixada!',
          description: 'Abra o WhatsApp, escolha a conversa e anexe a imagem baixada.',
        });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({ title: 'Erro ao compartilhar', variant: 'destructive' });
      }
    } finally {
      setLoading(null);
    }
  }

  async function handleInstagram() {
    setLoading('instagram');
    try {
      const blob = await getBlob();
      if (!blob) return;
      // Instagram doesn't accept deep links for image posts — download + instruct
      triggerDownload(blob, filename);
      toast({
        title: 'Imagem salva!',
        description: 'Abra o Instagram → Nova publicação → selecione do rolo de câmera.',
      });
    } catch {
      toast({ title: 'Erro ao baixar imagem', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  }

  async function handleCopy() {
    setLoading('copy');
    try {
      const blob = await getBlob();
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast({ title: 'Imagem copiada!', description: 'Cole diretamente em qualquer aplicativo.' });
      } catch {
        // Clipboard.write not supported (e.g. Firefox) — fallback to download
        triggerDownload(blob, filename);
        toast({
          title: 'Imagem baixada!',
          description: 'Seu navegador não suporta copiar imagens.',
        });
      }
    } catch {
      toast({ title: 'Erro ao processar imagem', variant: 'destructive' });
    } finally {
      setLoading(null);
    }
  }

  const busy = !!loading;

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      <Button size="sm" variant="outline" onClick={handleWhatsApp} disabled={busy} className="gap-1.5">
        {loading === 'whatsapp'
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <MessageCircle className="h-4 w-4 text-green-500" />}
        WhatsApp
      </Button>

      <Button size="sm" variant="outline" onClick={handleInstagram} disabled={busy} className="gap-1.5">
        {loading === 'instagram'
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : <Instagram className="h-4 w-4 text-pink-500" />}
        Instagram
      </Button>

      <Button size="sm" variant="outline" onClick={handleCopy} disabled={busy} className="gap-1.5">
        {loading === 'copy'
          ? <Loader2 className="h-4 w-4 animate-spin" />
          : copied
            ? <Check className="h-4 w-4 text-green-500" />
            : <Copy className="h-4 w-4" />}
        {copied ? 'Copiado!' : 'Copiar'}
      </Button>
    </div>
  );
}
