'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Users } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  category?: string;
  notes?: string;
  tags?: string[];
  created_at: string;
}

interface ContactWithStats extends Contact {
  lastBookingDate?: string;
  lastServiceName?: string;
  totalBookings: number;
  smartTags: string[];
}

type FilterType = 'all' | 'vip' | 'new' | 'inactive' | 'birthday';

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    'bg-purple-500', 'bg-blue-500', 'bg-green-500',
    'bg-pink-500', 'bg-orange-500', 'bg-teal-500',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
}

function computeSmartTags(contact: Contact, totalBookings: number, lastBookingDate?: string): string[] {
  const tags: string[] = [];
  const now = new Date();

  // Novo: criado nos últimos 30 dias e sem agendamentos anteriores
  const createdAt = new Date(contact.created_at);
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreated <= 30 && totalBookings <= 1) {
    tags.push('🆕 Novo');
  }

  // VIP: 5+ agendamentos
  if (totalBookings >= 5) {
    tags.push('⭐ VIP');
  }

  // Inativo: último agendamento há mais de 60 dias
  if (lastBookingDate) {
    const lastBooking = new Date(lastBookingDate);
    const daysSinceLastBooking = (now.getTime() - lastBooking.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastBooking > 60) {
      tags.push('⚠️ Inativo');
    }
  }

  return tags;
}

function formatLastVisit(dateStr?: string): string {
  if (!dateStr) return 'Nunca visitou';
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `há ${Math.floor(days / 30)} meses`;
  return `há ${Math.floor(days / 365)} ano(s)`;
}

export default function ClientsPage() {
  const [contacts, setContacts] = useState<ContactWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) return;

    // Buscar contatos
    const { data: contactsData } = await supabase
      .from('contacts')
      .select('*')
      .eq('professional_id', professional.id)
      .order('name', { ascending: true });

    if (!contactsData) {
      setLoading(false);
      return;
    }

    // Buscar agendamentos para calcular estatísticas
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('client_phone, booking_date, status')
      .eq('professional_id', professional.id)
      .eq('status', 'confirmed')
      .order('booking_date', { ascending: false });

    // Montar mapa de estatísticas por telefone
    const statsMap: Record<string, { lastDate: string; count: number }> = {};
    for (const booking of bookingsData || []) {
      const phone = booking.client_phone?.replace(/\D/g, '');
      if (!phone) continue;
      if (!statsMap[phone]) {
        statsMap[phone] = { lastDate: booking.booking_date, count: 0 };
      }
      statsMap[phone].count++;
    }

    // Combinar contatos com estatísticas
    const enriched: ContactWithStats[] = contactsData.map((contact) => {
      const phone = contact.phone?.replace(/\D/g, '');
      const stats = statsMap[phone] || { lastDate: undefined, count: 0 };
      const smartTags = computeSmartTags(contact, stats.count, stats.lastDate);

      return {
        ...contact,
        lastBookingDate: stats.lastDate,
        totalBookings: stats.count,
        smartTags,
      };
    });

    setContacts(enriched);
    setLoading(false);
  }

  // Filtros
  const filtered = contacts
    .filter((c) => {
      const term = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(term) ||
        c.phone.includes(term) ||
        c.email?.toLowerCase().includes(term)
      );
    })
    .filter((c) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'vip') return c.smartTags.includes('⭐ VIP');
      if (activeFilter === 'new') return c.smartTags.includes('🆕 Novo');
      if (activeFilter === 'inactive') return c.smartTags.includes('⚠️ Inativo');
      if (activeFilter === 'birthday') return c.tags?.includes('🎂 Aniversariante') ?? false;
      return true;
    });

  const counts = {
    all: contacts.length,
    vip: contacts.filter((c) => c.smartTags.includes('⭐ VIP')).length,
    new: contacts.filter((c) => c.smartTags.includes('🆕 Novo')).length,
    inactive: contacts.filter((c) => c.smartTags.includes('⚠️ Inativo')).length,
    birthday: contacts.filter((c) => c.tags?.includes('🎂 Aniversariante')).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">Carregando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">👥 Meus Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {contacts.length} {contacts.length === 1 ? 'cliente' : 'clientes'} no total
          </p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filtros Rápidos */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {([
          { key: 'all', label: 'Todos', count: counts.all },
          { key: 'birthday', label: '🎂 Aniversariantes', count: counts.birthday },
          { key: 'vip', label: '⭐ VIP', count: counts.vip },
          { key: 'new', label: '🆕 Novos', count: counts.new },
          { key: 'inactive', label: '⚠️ Inativos', count: counts.inactive },
        ] as { key: FilterType; label: string; count: number }[]).map((f) => (
          <Button
            key={f.key}
            variant={activeFilter === f.key ? 'default' : 'outline'}
            size="sm"
            className="whitespace-nowrap flex-shrink-0"
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label}
            {f.count > 0 && (
              <span className="ml-1.5 bg-white/20 text-xs rounded-full px-1.5 py-0.5">
                {f.count}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Grid de Clientes */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nenhum cliente encontrado</h3>
          <p className="text-muted-foreground text-sm mt-1">
            {searchTerm ? 'Tente outro termo de busca' : 'Ainda não há clientes nesta categoria'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((contact) => (
            <Card
              key={contact.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getAvatarColor(contact.name)}`}
                >
                  {getInitials(contact.name)}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Nome + Smart Tags */}
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-semibold text-sm leading-tight truncate">
                      {contact.name}
                    </h3>
                    <div className="flex gap-1 flex-shrink-0">
                      {contact.smartTags.map((tag) => (
                        <span key={tag} className="text-xs">{tag.split(' ')[0]}</span>
                      ))}
                    </div>
                  </div>

                  {/* Telefone */}
                  <p className="text-xs text-muted-foreground truncate">
                    📞 {contact.phone}
                  </p>

                  {/* Última visita */}
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Última visita</p>
                    <p className="text-xs font-medium mt-0.5">
                      {contact.lastBookingDate
                        ? `${formatLastVisit(contact.lastBookingDate)} · ${contact.totalBookings} visita${contact.totalBookings !== 1 ? 's' : ''}`
                        : 'Sem agendamentos'}
                    </p>
                  </div>

                  {/* Tags manuais */}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {contact.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
