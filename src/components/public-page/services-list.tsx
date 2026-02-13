import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import type { Service } from '@/types/database';

interface ServicesListProps {
  services: Service[];
  currency: string;
}

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '\u20AC', GBP: '\u00A3', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(price).toFixed(0)}`;
}

export function ServicesList({ services, currency }: ServicesListProps) {
  if (services.length === 0) {
    return (
      <section className="px-4 sm:px-6 py-6">
        <h2 className="text-lg font-semibold mb-4">Serviços</h2>
        <p className="text-muted-foreground text-sm">Nenhum servico cadastrado ainda.</p>
      </section>
    );
  }

  return (
    <section className="px-4 sm:px-6 py-6">
      <h2 className="text-lg font-semibold mb-4">Serviços</h2>
      <div className="space-y-3">
        {services.map((service) => (
          <Card key={service.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium">{service.name}</h3>
                {service.description && (
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {service.description}
                  </p>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3" />
                  {service.duration_minutes} min
                </span>
              </div>
              <div className="text-right pl-4">
                <span className="text-lg font-bold">
                  {formatPrice(service.price, currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
