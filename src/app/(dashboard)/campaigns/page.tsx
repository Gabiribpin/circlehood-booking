'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, MessageSquare, Send, Users, ExternalLink, Clock, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  category?: string;
}

interface Campaign {
  id: string;
  name: string;
  message: string;
  status: string; // draft | scheduled | sending | completed | cancelled
  created_at: string;
  sent_at?: string;
  total_count?: number;
  sent_count?: number;
  failed_count?: number;
  scheduled_at?: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasActiveWhatsApp, setHasActiveWhatsApp] = useState(false);
  const [professionalId, setProfessionalId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [delaySecs, setDelaySecs] = useState(30);
  const [contactSearch, setContactSearch] = useState('');
  const { toast } = useToast();

  // Form states
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: professional } = await supabase
      .from('professionals').select('id').eq('user_id', user.id).single();
    if (!professional) return;
    setProfessionalId(professional.id);

    // Qualquer config WhatsApp ativa (Meta ou Evolution)
    const { data: wc } = await supabase
      .from('whatsapp_config').select('is_active').eq('user_id', user.id).single();
    setHasActiveWhatsApp(wc?.is_active === true);

    const [campaignsRes, contactsRes] = await Promise.all([
      supabase.from('campaigns').select('*').eq('professional_id', professional.id)
        .order('created_at', { ascending: false }),
      supabase.from('contacts').select('id, name, phone, email, category')
        .eq('professional_id', professional.id).order('name'),
    ]);

    setCampaigns(campaignsRes.data || []);
    setContacts(contactsRes.data || []);
    setLoading(false);
  }

  async function handleCreateCampaign() {
    if (!campaignName || !campaignMessage) {
      toast({ title: 'Campos obrigatórios', description: 'Nome e mensagem são obrigatórios', variant: 'destructive' });
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from('campaigns').insert({
      professional_id: professionalId,
      name: campaignName,
      message: campaignMessage,
      status: 'draft',
    });
    if (error) { toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Campanha criada!' });
    resetForm();
    setIsCreateDialogOpen(false);
    loadData();
  }

  function resetForm() { setCampaignName(''); setCampaignMessage(''); }

  function handleSelectContact(id: string) {
    setSelectedContacts((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  function handleSelectAll() {
    const filteredIds = filteredContacts.map((c) => c.id);
    const allSelected = filteredIds.every((id) => selectedContacts.includes(id));
    if (allSelected) {
      setSelectedContacts((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelectedContacts((prev) => [...new Set([...prev, ...filteredIds])]);
    }
  }

  function generateWhatsAppLink(contact: Contact, message: string) {
    const msg = message.replace('{nome}', contact.name);
    return `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  }

  function handleOpenSendDialog(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setSelectedContacts([]);
    setContactSearch('');
    setIsSendDialogOpen(true);
  }

  async function handleScheduleCampaign() {
    if (!selectedCampaign || selectedContacts.length === 0) return;
    setIsScheduling(true);
    const supabase = createClient();

    try {
      const now = new Date();
      const sends = selectedContacts.map((contactId, i) => {
        const contact = contacts.find((c) => c.id === contactId)!;
        const scheduledFor = new Date(now.getTime() + (i + 1) * delaySecs * 1000);
        return {
          campaign_id: selectedCampaign.id,
          professional_id: professionalId,
          contact_id: contactId,
          phone: contact.phone,
          name: contact.name,
          status: 'pending',
          scheduled_for: scheduledFor.toISOString(),
        };
      });

      // Inserir campaign_sends em lotes de 100
      for (let i = 0; i < sends.length; i += 100) {
        const { error } = await supabase.from('campaign_sends').insert(sends.slice(i, i + 100));
        if (error) throw error;
      }

      // Atualizar campanha
      const { error: updErr } = await supabase.from('campaigns').update({
        status: 'scheduled',
        total_count: selectedContacts.length,
        sent_count: 0,
        failed_count: 0,
        scheduled_at: now.toISOString(),
      }).eq('id', selectedCampaign.id);
      if (updErr) throw updErr;

      const finishMin = Math.ceil((selectedContacts.length * delaySecs) / 60);
      toast({
        title: 'Campanha agendada!',
        description: `${selectedContacts.length} mensagens serão enviadas em ~${finishMin} minuto${finishMin !== 1 ? 's' : ''}.`,
      });
      setIsSendDialogOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: 'Erro ao agendar', description: err.message, variant: 'destructive' });
    } finally {
      setIsScheduling(false);
    }
  }

  const filteredContacts = contacts.filter((c) => {
    const t = contactSearch.toLowerCase();
    return c.name.toLowerCase().includes(t) || c.phone.includes(t);
  });

  const allFilteredSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selectedContacts.includes(c.id));

  if (loading) return <div className="p-8">Carregando...</div>;

  if (!hasActiveWhatsApp) {
    return (
      <div className="max-w-2xl mx-auto mt-20 px-4">
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8 text-center">
          <span className="text-6xl mb-4 block">⚠️</span>
          <h2 className="text-2xl font-bold text-yellow-900 mb-4">WhatsApp não configurado</h2>
          <p className="text-yellow-800 mb-6">
            Configure o WhatsApp (Meta Business ou Evolution API) para enviar campanhas automaticamente.
          </p>
          <Link href="/whatsapp-config">
            <Button size="lg">💼 Configurar WhatsApp</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">📢 Campanhas</h1>
          <p className="text-muted-foreground text-sm">Envie mensagens em massa para seus contatos via WhatsApp</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => { setIsCreateDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nova Campanha</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
              <DialogDescription>Escreva a mensagem e depois escolha os contatos para enviar.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="c-name">Nome da campanha *</Label>
                <Input id="c-name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Promoção Junho" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-msg">Mensagem *</Label>
                <Textarea id="c-msg" value={campaignMessage} onChange={(e) => setCampaignMessage(e.target.value)}
                  placeholder="Oi {nome}! Faz tempo que não nos vemos. Que tal agendar suas unhas? 💅" rows={5} />
                <p className="text-xs text-muted-foreground">
                  Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para personalizar com o nome do contato
                </p>
              </div>
              {campaignMessage && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-xs font-medium mb-1 text-muted-foreground">Prévia:</p>
                  <p className="text-sm whitespace-pre-wrap">{campaignMessage.replace('{nome}', 'Maria')}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); resetForm(); }}>Cancelar</Button>
              <Button onClick={handleCreateCampaign}>Criar campanha</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhum contato cadastrado</h3>
            <p className="text-muted-foreground mt-2">Adicione contatos antes de criar campanhas</p>
            <Button asChild variant="outline" className="mt-4"><Link href="/clients?tab=manage">Ir para Contatos</Link></Button>
          </CardContent>
        </Card>
      )}

      {campaigns.length === 0 && contacts.length > 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Nenhuma campanha ainda</h3>
            <p className="text-muted-foreground mt-2">Crie sua primeira campanha para divulgar seus serviços</p>
          </CardContent>
        </Card>
      ) : campaigns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              {campaigns.length} {campaigns.length === 1 ? 'Campanha' : 'Campanhas'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Criada</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{campaign.message}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      {(campaign.total_count ?? 0) > 0 ? (
                        <span className="text-sm text-muted-foreground">
                          {campaign.sent_count ?? 0}/{campaign.total_count}
                          {(campaign.failed_count ?? 0) > 0 && (
                            <span className="text-destructive ml-1">({campaign.failed_count} falha{campaign.failed_count !== 1 ? 's' : ''})</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      {campaign.status === 'draft' && (
                        <Button size="sm" onClick={() => handleOpenSendDialog(campaign)}>
                          <Zap className="mr-1.5 h-3.5 w-3.5" /> Escalonar envio
                        </Button>
                      )}
                      {campaign.status === 'completed' && (
                        <span className="text-xs text-muted-foreground">Concluída</span>
                      )}
                      {(campaign.status === 'scheduled' || campaign.status === 'sending') && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Em andamento
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* Dialog de escalonamento */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escalonar envio: {selectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              Selecione os contatos. As mensagens serão enviadas automaticamente em intervalos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {selectedCampaign && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem que será enviada:</p>
                <p className="text-sm whitespace-pre-wrap">{selectedCampaign.message.replace('{nome}', '[nome do contato]')}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="space-y-1 flex-1">
                <Label htmlFor="delay">Intervalo entre mensagens (segundos)</Label>
                <Input id="delay" type="number" min={10} max={300} value={delaySecs}
                  onChange={(e) => setDelaySecs(Math.max(10, Number(e.target.value)))} className="w-32" />
                <p className="text-xs text-muted-foreground">Mínimo 10s. Recomendado: 30s para evitar bloqueios.</p>
              </div>
            </div>

            {selectedContacts.length > 0 && (
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                {selectedContacts.length} contato{selectedContacts.length !== 1 ? 's' : ''} selecionado{selectedContacts.length !== 1 ? 's' : ''} ·{' '}
                Tempo estimado: ~{Math.ceil((selectedContacts.length * delaySecs) / 60)} min
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Contatos ({contacts.length})</Label>
                <Input placeholder="Buscar..." value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} className="w-40 h-7 text-sm" />
              </div>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {allFilteredSelected ? 'Desmarcar' : 'Selecionar todos'}
              </Button>
            </div>

            <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
              {filteredContacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => handleSelectContact(contact.id)}
                    />
                    <div>
                      <p className="text-sm font-medium">{contact.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{contact.phone}</p>
                    </div>
                  </div>
                  {selectedCampaign && (
                    <Button size="sm" variant="ghost" asChild className="text-xs h-7">
                      <a href={generateWhatsAppLink(contact, selectedCampaign.message)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3 mr-1" /> Manual
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleScheduleCampaign}
              disabled={selectedContacts.length === 0 || isScheduling}
            >
              {isScheduling ? 'Agendando...' : (
                <><Send className="mr-2 h-4 w-4" /> Agendar {selectedContacts.length} envio{selectedContacts.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStatusBadge(status: string) {
  switch (status) {
    case 'draft':      return <Badge variant="secondary">Rascunho</Badge>;
    case 'scheduled':  return <Badge variant="outline" className="text-blue-600 border-blue-300">Agendada</Badge>;
    case 'sending':    return <Badge className="bg-orange-500">Enviando</Badge>;
    case 'completed':  return <Badge className="bg-green-600">Concluída</Badge>;
    case 'cancelled':  return <Badge variant="destructive">Cancelada</Badge>;
    default:           return <Badge variant="outline">{status}</Badge>;
  }
}
