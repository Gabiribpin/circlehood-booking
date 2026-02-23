import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MapPin,
  Clock,
  Phone,
  Instagram,
  MessageCircle,
  Star,
} from 'lucide-react';
import Link from 'next/link';

const DEMO_SERVICES = [
  {
    id: '1',
    name: 'Manicure Completa',
    description: 'Manicure com esmaltação em gel, incluindo cutículas e hidratação',
    duration: 60,
    price: 35,
  },
  {
    id: '2',
    name: 'Pedicure Spa',
    description: 'Pedicure relaxante com esfoliação, hidratação profunda e esmaltação',
    duration: 75,
    price: 45,
  },
  {
    id: '3',
    name: 'Unhas em Gel com Design',
    description: 'Alongamento em gel com decoração personalizada e nail art',
    duration: 120,
    price: 80,
  },
];

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Hero / Profile Section */}
      <div className="relative">
        <div className="h-32 bg-gradient-to-r from-pink-400 to-purple-400" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="-mt-16 sm:-mt-20">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
              <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-pink-400 to-purple-400 text-white">
                  MN
                </AvatarFallback>
              </Avatar>
              <div className="text-center sm:text-left pb-2">
                <h1 className="text-3xl font-bold">Maria's Nails</h1>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                  <Badge className="bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-100">
                    Nail Tech
                  </Badge>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Dublin, Ireland
                  </span>
                  <div className="flex items-center gap-1 text-sm text-yellow-600">
                    <Star className="h-4 w-4 fill-yellow-500" />
                    <Star className="h-4 w-4 fill-yellow-500" />
                    <Star className="h-4 w-4 fill-yellow-500" />
                    <Star className="h-4 w-4 fill-yellow-500" />
                    <Star className="h-4 w-4 fill-yellow-500" />
                    <span className="ml-1 text-muted-foreground">(127)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bio */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <p className="text-muted-foreground leading-relaxed">
                  Olá! Sou a Maria, nail tech profissional com mais de 8 anos de experiência.
                  Especializada em unhas em gel, nail art e designs personalizados.
                  Atendo em estúdio particular no centro de Dublin com ambiente aconchegante
                  e todos os cuidados de higiene. Venha se sentir especial! 💅✨
                </p>
              </CardContent>
            </Card>

            {/* Contact Info */}
            <div className="flex flex-wrap gap-3 mt-4">
              <a
                href="https://wa.me/353871234567"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-accent transition-colors text-sm"
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
                WhatsApp
              </a>
              <a
                href="tel:+353871234567"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-accent transition-colors text-sm"
              >
                <Phone className="h-4 w-4" />
                Ligar
              </a>
              <a
                href="https://instagram.com/mariasnails"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border hover:bg-accent transition-colors text-sm"
              >
                <Instagram className="h-4 w-4 text-pink-600" />
                @mariasnails
              </a>
            </div>

            {/* Services */}
            <div className="mt-8">
              <h2 className="text-2xl font-bold mb-4">Serviços</h2>
              <div className="grid gap-4">
                {DEMO_SERVICES.map((service) => (
                  <Card key={service.id} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold">{service.name}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {service.description}
                          </p>
                          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {service.duration} min
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-primary">
                            €{service.price}
                          </p>
                          <Button className="mt-3" asChild>
                            <Link href="/register">
                              Agendar
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Demo Banner */}
            <Card className="mt-8 mb-8 border-primary/50 bg-primary/5">
              <CardContent className="p-6 text-center">
                <p className="text-lg font-semibold mb-2">
                  Esta é uma página de demonstração
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie sua própria página profissional como esta em minutos!
                </p>
                <Button size="lg" asChild>
                  <Link href="/register">
                    Criar Minha Página Grátis
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Maria's Nails - Demo | CircleHood",
  description: 'Página de demonstração de profissional no CircleHood Booking',
};
