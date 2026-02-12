import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';
import type { Professional } from '@/types/database';

interface HeroProps {
  professional: Professional;
}

export function Hero({ professional }: HeroProps) {
  const initials = professional.business_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="relative">
      {/* Cover */}
      <div className="h-40 sm:h-52 bg-gradient-to-br from-primary/80 to-primary/40 rounded-b-3xl">
        {professional.cover_image_url && (
          <img
            src={professional.cover_image_url}
            alt=""
            className="w-full h-full object-cover rounded-b-3xl"
          />
        )}
      </div>

      {/* Profile info */}
      <div className="px-4 sm:px-6 -mt-16 relative z-10">
        <Avatar className="h-28 w-28 border-4 border-background shadow-lg">
          <AvatarImage src={professional.profile_image_url || undefined} alt={professional.business_name} />
          <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="mt-3">
          <h1 className="text-2xl sm:text-3xl font-bold">{professional.business_name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {professional.category && (
              <Badge variant="secondary">{professional.category}</Badge>
            )}
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {professional.city}, {professional.country}
            </span>
          </div>
          {professional.bio && (
            <p className="mt-3 text-muted-foreground leading-relaxed">{professional.bio}</p>
          )}
        </div>
      </div>
    </section>
  );
}
