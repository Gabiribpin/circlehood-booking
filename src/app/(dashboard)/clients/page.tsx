'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Edit, Upload, Search, Users, Cake } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { RegionSelector } from '@/components/clients/region-selector';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  category?: string;
  notes?: string;
  tags?: string[];
  regions?: string[];
  birthday?: string;
  use_bot?: boolean;
  created_at: string;
}

interface ContactWithStats extends Contact {
  lastBookingDate?: string;
  totalBookings: number;
  smartTags: string[];
}

type FilterType = 'all' | 'vip' | 'new' | 'inactive' | 'birthday';
type BotFilter = 'all' | 'bot_on' | 'bot_off';

// ─── CRM helpers ──────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

function getAvatarColor(name: string) {
  const colors = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500'];
  return colors[name.charCodeAt(0) % colors.length];
}

function isBirthdayThisMonth(birthday?: string): boolean {
  if (!birthday) return false;
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const parts = birthday.split('-');
  if (parts.length < 2) return false;
  return parseInt(parts[1], 10) === currentMonth;
}

function formatBirthdayDisplay(birthday: string): string {
  // YYYY-MM-DD → "DD/MM" or "DD/MM/YYYY"
  const parts = birthday.split('-');
  if (parts.length < 3) return birthday;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function computeSmartTags(contact: Contact, totalBookings: number, lastBookingDate?: string) {
  const tags: string[] = [];
  const now = new Date();
  const daysSinceCreated = (now.getTime() - new Date(contact.created_at).getTime()) / 86400000;
  if (daysSinceCreated <= 30 && totalBookings <= 1) tags.push('🆕 Novo');
  if (totalBookings >= 5) tags.push('⭐ VIP');
  if (lastBookingDate) {
    const days = (now.getTime() - new Date(lastBookingDate).getTime()) / 86400000;
    if (days > 60) tags.push('⚠️ Inativo');
  }
  return tags;
}

function formatLastVisit(dateStr?: string) {
  if (!dateStr) return 'Nunca visitou';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Ontem';
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `há ${Math.floor(days / 30)} meses`;
  return `há ${Math.floor(days / 365)} ano(s)`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClientsPage() {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'manage' ? 'manage' : 'crm';

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold">👥 Clientes</h1>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="crm">📊 CRM</TabsTrigger>
          <TabsTrigger value="manage">⚙️ Gerenciar</TabsTrigger>
        </TabsList>

        <TabsContent value="crm" className="mt-4">
          <CRMView />
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <ManageView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Aba CRM ──────────────────────────────────────────────────────────────────

function CRMView() {
  const [contacts, setContacts] = useState<ContactWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => { loadClients(); }, []);

  async function loadClients() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: professional } = await supabase
      .from('professionals').select('id').eq('user_id', user.id).single();
    if (!professional) return;

    const [{ data: contactsData }, { data: bookingsData }] = await Promise.all([
      supabase.from('contacts').select('*').eq('professional_id', professional.id).order('name'),
      supabase.from('bookings').select('client_phone, booking_date')
        .eq('professional_id', professional.id).eq('status', 'confirmed')
        .order('booking_date', { ascending: false }),
    ]);

    if (!contactsData) { setLoading(false); return; }

    const statsMap: Record<string, { lastDate: string; count: number }> = {};
    for (const b of bookingsData || []) {
      const p = b.client_phone?.replace(/\D/g, '');
      if (!p) continue;
      if (!statsMap[p]) statsMap[p] = { lastDate: b.booking_date, count: 0 };
      statsMap[p].count++;
    }

    setContacts(contactsData.map((c) => {
      const stats = statsMap[c.phone?.replace(/\D/g, '')] ?? { lastDate: undefined, count: 0 };
      return { ...c, lastBookingDate: stats.lastDate, totalBookings: stats.count, smartTags: computeSmartTags(c, stats.count, stats.lastDate) };
    }));
    setLoading(false);
  }

  const filtered = contacts
    .filter((c) => {
      const t = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(t) || c.phone.includes(t) || c.email?.toLowerCase().includes(t);
    })
    .filter((c) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'vip') return c.smartTags.includes('⭐ VIP');
      if (activeFilter === 'new') return c.smartTags.includes('🆕 Novo');
      if (activeFilter === 'inactive') return c.smartTags.includes('⚠️ Inativo');
      if (activeFilter === 'birthday') return isBirthdayThisMonth(c.birthday);
      return true;
    });

  const counts = {
    all: contacts.length,
    vip: contacts.filter((c) => c.smartTags.includes('⭐ VIP')).length,
    new: contacts.filter((c) => c.smartTags.includes('🆕 Novo')).length,
    inactive: contacts.filter((c) => c.smartTags.includes('⚠️ Inativo')).length,
    birthday: contacts.filter((c) => isBirthdayThisMonth(c.birthday)).length,
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
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">{contacts.length} {contacts.length === 1 ? 'cliente' : 'clientes'} no total</p>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, telefone ou email..." value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {([
          { key: 'all', label: 'Todos', count: counts.all },
          { key: 'birthday', label: '🎂 Aniversariantes', count: counts.birthday },
          { key: 'vip', label: '⭐ VIP', count: counts.vip },
          { key: 'new', label: '🆕 Novos', count: counts.new },
          { key: 'inactive', label: '⚠️ Inativos', count: counts.inactive },
        ] as { key: FilterType; label: string; count: number }[]).map((f) => (
          <Button key={f.key} variant={activeFilter === f.key ? 'default' : 'outline'} size="sm"
            className="whitespace-nowrap flex-shrink-0" onClick={() => setActiveFilter(f.key)}>
            {f.label}
            {f.count > 0 && <span className="ml-1.5 bg-white/20 text-xs rounded-full px-1.5 py-0.5">{f.count}</span>}
          </Button>
        ))}
      </div>

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
          {filtered.map((c) => (
            <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 ${getAvatarColor(c.name)}`}>
                  {getInitials(c.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h3 className="font-semibold text-sm leading-tight truncate">{c.name}</h3>
                    <div className="flex gap-1 flex-shrink-0">
                      {c.smartTags.map((tag) => <span key={tag} className="text-xs">{tag.split(' ')[0]}</span>)}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">📞 {c.phone}</p>
                  {c.birthday && (
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Cake className="h-3 w-3" />
                      {formatBirthdayDisplay(c.birthday)}
                      {isBirthdayThisMonth(c.birthday) && (
                        <span className="text-pink-500 font-medium">· Este mês!</span>
                      )}
                    </p>
                  )}
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-xs text-muted-foreground">Última visita</p>
                    <p className="text-xs font-medium mt-0.5">
                      {c.lastBookingDate
                        ? `${formatLastVisit(c.lastBookingDate)} · ${c.totalBookings} visita${c.totalBookings !== 1 ? 's' : ''}`
                        : 'Sem agendamentos'}
                    </p>
                  </div>
                  {c.tags && c.tags.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {c.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">{tag}</Badge>
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

// ─── Aba Gerenciar ────────────────────────────────────────────────────────────

function ManageView() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [botFilter, setBotFilter] = useState<BotFilter>('all');
  const [professionalId, setProfessionalId] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [birthday, setBirthday] = useState('');
  const [regions, setRegions] = useState<string[]>([]);

  useEffect(() => { loadContacts(); }, []);

  async function loadContacts() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: professional } = await supabase
      .from('professionals').select('id').eq('user_id', user.id).single();
    if (!professional) return;
    setProfessionalId(professional.id);

    const { data, error } = await supabase
      .from('contacts').select('*').eq('professional_id', professional.id)
      .order('created_at', { ascending: false });

    if (error) { toast({ title: 'Erro ao carregar contatos', description: error.message, variant: 'destructive' }); return; }
    setContacts(data || []);
    setSelectedIds(new Set());
    setLoading(false);
  }

  async function handleSave() {
    if (!name || !phone) {
      toast({ title: 'Campos obrigatórios', description: 'Nome e telefone são obrigatórios', variant: 'destructive' });
      return;
    }
    const supabase = createClient();

    if (editingContact) {
      const { error } = await supabase.from('contacts')
        .update({ name, phone, email: email || null, category: category || null, notes: notes || null, birthday: birthday || null, regions, updated_at: new Date().toISOString() })
        .eq('id', editingContact.id);
      if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Contato atualizado!' });
    } else {
      const { error } = await supabase.from('contacts')
        .insert({ professional_id: professionalId, name, phone, email: email || null, category: category || null, notes: notes || null, birthday: birthday || null, regions });
      if (error) { toast({ title: 'Erro ao adicionar', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Contato adicionado!' });
    }
    resetForm();
    setIsDialogOpen(false);
    loadContacts();
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;
    const supabase = createClient();
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Contato excluído!' });
    loadContacts();
  }

  function handleEdit(contact: Contact) {
    setEditingContact(contact);
    setName(contact.name); setPhone(contact.phone); setEmail(contact.email || '');
    setCategory(contact.category || ''); setNotes(contact.notes || '');
    setBirthday(contact.birthday || ''); setRegions(contact.regions || []);
    setIsDialogOpen(true);
  }

  function resetForm() {
    setEditingContact(null); setName(''); setPhone(''); setEmail(''); setCategory(''); setNotes(''); setBirthday(''); setRegions([]);
  }

  async function updateUseBot(id: string, val: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from('contacts').update({ use_bot: val }).eq('id', id);
    if (error) { toast({ title: 'Erro ao atualizar bot', description: error.message, variant: 'destructive' }); return; }
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, use_bot: val } : c));
  }

  async function bulkUpdateBot(val: boolean) {
    if (selectedIds.size === 0) return;
    const supabase = createClient();
    const { error } = await supabase.from('contacts').update({ use_bot: val }).in('id', [...selectedIds]);
    if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: val ? '🤖 Bot ativado' : '🚫 Bot desativado', description: `${selectedIds.size} contato${selectedIds.size !== 1 ? 's' : ''} atualizado${selectedIds.size !== 1 ? 's' : ''}` });
    setContacts((prev) => prev.map((c) => selectedIds.has(c.id) ? { ...c, use_bot: val } : c));
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filtered = contacts
    .filter((c) => {
      const t = searchTerm.toLowerCase();
      return c.name.toLowerCase().includes(t) || c.phone.includes(t) || c.email?.toLowerCase().includes(t);
    })
    .filter((c) => {
      if (botFilter === 'bot_on') return (c.use_bot ?? true) === true;
      if (botFilter === 'bot_off') return (c.use_bot ?? true) === false;
      return true;
    });

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((c) => c.id)));
    }
  }

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-muted-foreground text-sm">Gerencie seus contatos para campanhas de marketing</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/clients/import')}>
            <Upload className="mr-2 h-4 w-4" /> Importar CSV
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Adicionar Contato</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingContact ? 'Editar Contato' : 'Adicionar Contato'}</DialogTitle>
                <DialogDescription>Preencha os dados do contato abaixo</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="c-name">Nome *</Label>
                  <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maria Silva" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-phone">Telefone *</Label>
                  <PhoneInput value={phone} onChange={(v) => setPhone(v || '')} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-email">Email</Label>
                  <Input id="c-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-birthday">Aniversário</Label>
                  <Input id="c-birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-category">Categoria</Label>
                  <Input id="c-category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: Unhas, Cabelo" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-notes">Notas</Label>
                  <Textarea id="c-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Observações..." />
                </div>
                <RegionSelector value={regions} onChange={setRegions} label="Regiões de Dublin" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>Cancelar</Button>
                <Button onClick={handleSave}>{editingContact ? 'Atualizar' : 'Adicionar'}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>{filtered.length} {filtered.length === 1 ? 'Contato' : 'Contatos'}</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative w-56">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar contatos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8" />
              </div>
              {/* Filtros de bot */}
              <div className="flex gap-1">
                {([
                  { key: 'all', label: 'Todos' },
                  { key: 'bot_on', label: '🤖 Bot Ativo' },
                  { key: 'bot_off', label: '🚫 Bot Desativado' },
                ] as { key: BotFilter; label: string }[]).map((f) => (
                  <Button key={f.key} variant={botFilter === f.key ? 'default' : 'outline'} size="sm"
                    className="whitespace-nowrap text-xs" onClick={() => setBotFilter(f.key)}>
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 pt-2 flex-wrap">
              <span className="text-sm text-muted-foreground">{selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}</span>
              <Button size="sm" variant="outline" onClick={() => bulkUpdateBot(true)}>
                🤖 Ativar bot ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkUpdateBot(false)}>
                🚫 Desativar bot ({selectedIds.size})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum contato ainda</h3>
              <p className="text-muted-foreground mt-2">Adicione seus primeiros contatos para começar campanhas</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-center">Bot</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className={selectedIds.has(c.id) ? 'bg-muted/40' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="cursor-pointer"
                        aria-label={`Selecionar ${c.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                    <TableCell>{c.email || '-'}</TableCell>
                    <TableCell>{c.category || '-'}</TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={c.use_bot ?? true}
                        onCheckedChange={(val) => updateUseBot(c.id, val)}
                        aria-label={`Bot ${c.use_bot ?? true ? 'ativo' : 'inativo'} para ${c.name}`}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Como importar contatos via CSV</CardTitle>
          <CardDescription>Formato do arquivo (primeira linha é o cabeçalho):</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-sm">{`nome,telefone,email,notas
Maria Silva,+5511999999999,maria@exemplo.com,Cliente VIP
Ana Costa,+5511988888888,ana@exemplo.com,`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
