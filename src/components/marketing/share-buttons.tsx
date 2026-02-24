'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Share2, Copy, Check, MessageCircle, Facebook, Instagram } from 'lucide-react';

interface ShareButtonsProps {
  url: string;
  title?: string;
  text?: string;
  className?: string;
}

export function ShareButtons({ url, title, text, className }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [copiedInsta, setCopiedInsta] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  async function handleWebShare() {
    try {
      await navigator.share({ url, title, text });
    } catch {
      // Dismissed or not supported — ignore
    }
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleInstagram() {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedInsta(true);
      setTimeout(() => setCopiedInsta(false), 2500);
    });
  }

  const encodedUrl = encodeURIComponent(url);
  const waText = encodeURIComponent((text ? `${text}\n` : '') + url);
  const whatsappUrl = `https://wa.me/?text=${waText}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

  return (
    <div className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {canShare && (
        <Button size="sm" variant="outline" onClick={handleWebShare}>
          <Share2 className="h-4 w-4 mr-1.5" />
          Compartilhar
        </Button>
      )}

      {/* WhatsApp */}
      <Button size="sm" variant="outline" asChild>
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-4 w-4 mr-1.5 text-green-500" />
          WhatsApp
        </a>
      </Button>

      {/* Facebook */}
      <Button size="sm" variant="outline" asChild>
        <a href={facebookUrl} target="_blank" rel="noopener noreferrer">
          <Facebook className="h-4 w-4 mr-1.5 text-blue-600" />
          Facebook
        </a>
      </Button>

      {/* Instagram — copies link */}
      <Button
        size="sm"
        variant="outline"
        onClick={handleInstagram}
        title="Copie o link e cole no Instagram"
      >
        {copiedInsta ? (
          <Check className="h-4 w-4 mr-1.5 text-green-500" />
        ) : (
          <Instagram className="h-4 w-4 mr-1.5 text-pink-500" />
        )}
        {copiedInsta ? 'Copiado!' : 'Instagram'}
      </Button>

      {/* Copy link */}
      <Button size="sm" variant="outline" onClick={handleCopyLink}>
        {copied ? (
          <Check className="h-4 w-4 mr-1.5 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 mr-1.5" />
        )}
        {copied ? 'Copiado!' : 'Copiar link'}
      </Button>
    </div>
  );
}
