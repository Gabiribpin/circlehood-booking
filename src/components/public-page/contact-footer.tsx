import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { MessageCircle, Instagram, Phone, MapPin } from 'lucide-react';
import type { Professional } from '@/types/database';

interface ContactFooterProps {
  professional: Professional;
}

export function ContactFooter({ professional }: ContactFooterProps) {
  const whatsappLink = professional.whatsapp
    ? `https://wa.me/${professional.whatsapp.replace(/\D/g, '')}`
    : null;

  const instagramLink = professional.instagram
    ? `https://instagram.com/${professional.instagram.replace('@', '')}`
    : null;

  return (
    <footer className="px-4 sm:px-6 py-6">
      <Separator className="mb-6" />

      <div className="flex flex-wrap gap-3 mb-6">
        {whatsappLink && (
          <Button asChild variant="outline" className="gap-2">
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>
        )}
        {instagramLink && (
          <Button asChild variant="outline" className="gap-2">
            <a href={instagramLink} target="_blank" rel="noopener noreferrer">
              <Instagram className="h-4 w-4" />
              Instagram
            </a>
          </Button>
        )}
        {professional.phone && (
          <Button asChild variant="outline" className="gap-2">
            <a href={`tel:${professional.phone}`}>
              <Phone className="h-4 w-4" />
              Ligar
            </a>
          </Button>
        )}
      </div>

      {professional.address && (
        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-4">
          <MapPin className="h-4 w-4 shrink-0" />
          {professional.address}
        </p>
      )}

      <div className="text-center pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          Powered by{' '}
          <a
            href="https://book.circlehood-tech.com"
            className="font-medium text-primary hover:underline"
          >
            CircleHood Booking
          </a>
        </p>
      </div>
    </footer>
  );
}
