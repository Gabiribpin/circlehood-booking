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
import { Plus, MessageSquare, Send, Users, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

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
  status: string;
  created_at: string;
  sent_at?: string;
  _count?: number;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [professionalId, setProfessionalId] = useState<string>('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const { toast } = useToast();

  // Form states
  const [campaignName, setCampaignName] = useState('');
  const [campaignMessage, setCampaignMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();

    // Get professional ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional) return;
    setProfessionalId(professional.id);

    // Load campaigns and contacts
    const [campaignsRes, contactsRes] = await Promise.all([
      supabase
        .from('campaigns')
        .select('*')
        .eq('professional_id', professional.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('contacts')
        .select('*')
        .eq('professional_id', professional.id)
        .order('name', { ascending: true }),
    ]);

    if (campaignsRes.error) {
      toast({
        title: 'Erro ao carregar campanhas',
        description: campaignsRes.error.message,
        variant: 'destructive',
      });
      return;
    }

    if (contactsRes.error) {
      toast({
        title: 'Erro ao carregar contatos',
        description: contactsRes.error.message,
        variant: 'destructive',
      });
      return;
    }

    setCampaigns(campaignsRes.data || []);
    setContacts(contactsRes.data || []);
    setLoading(false);
  }

  async function handleCreateCampaign() {
    if (!campaignName || !campaignMessage) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e mensagem são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        professional_id: professionalId,
        name: campaignName,
        message: campaignMessage,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      toast({
        title: 'Erro ao criar campanha',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Campanha criada!',
      description: 'Agora você pode enviar para seus contatos.',
    });

    resetForm();
    setIsCreateDialogOpen(false);
    loadData();
  }

  function resetForm() {
    setCampaignName('');
    setCampaignMessage('');
  }

  function handleSelectContact(contactId: string) {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    );
  }

  function handleSelectAll() {
    if (selectedContacts.length === contacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(contacts.map((c) => c.id));
    }
  }

  function generateWhatsAppLink(contact: Contact, message: string) {
    const personalizedMessage = message.replace('{nome}', contact.name);
    const encodedMessage = encodeURIComponent(personalizedMessage);
    const cleanPhone = contact.phone.replace(/\D/g, '');
    return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
  }

  function handleOpenSendDialog(campaign: Campaign) {
    setSelectedCampaign(campaign);
    setSelectedContacts([]);
    setIsSendDialogOpen(true);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Rascunho</Badge>;
      case 'sent':
        return <Badge>Enviada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campanhas de Marketing</h1>
          <p className="text-muted-foreground">
            Envie mensagens personalizadas para seus contatos via WhatsApp
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Campanha</DialogTitle>
              <DialogDescription>
                Crie uma mensagem personalizada para enviar aos seus contatos
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Campanha *</Label>
                <Input
                  id="name"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  placeholder="Ex: Lembrete de Unhas - Junho"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem *</Label>
                <Textarea
                  id="message"
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  placeholder="Oi {nome}! Faz tempo que não nos vemos. Que tal agendar suas unhas essa semana? 💅"
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Use <code className="bg-muted px-1 py-0.5 rounded">{'{nome}'}</code> para personalizar com o nome do contato
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="text-sm font-medium mb-2">Prévia da mensagem:</h4>
                <p className="text-sm whitespace-pre-wrap">
                  {campaignMessage.replace('{nome}', 'Maria') || 'Sua mensagem aparecerá aqui...'}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button onClick={handleCreateCampaign}>
                Criar Campanha
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum contato cadastrado</h3>
              <p className="text-muted-foreground mt-2">
                Adicione contatos primeiro para criar campanhas
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link href="/contacts">
                  Adicionar Contatos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {campaigns.length === 0 && contacts.length > 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhuma campanha ainda</h3>
              <p className="text-muted-foreground mt-2">
                Crie sua primeira campanha para começar a divulgar seus serviços
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
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
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell className="max-w-xs truncate">{campaign.message}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>
                      {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleOpenSendDialog(campaign)}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Enviar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Send Campaign Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar: {selectedCampaign?.name}</DialogTitle>
            <DialogDescription>
              Selecione os contatos e clique nos botões de WhatsApp para enviar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Mensagem:</h4>
              <p className="text-sm whitespace-pre-wrap">{selectedCampaign?.message}</p>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-base">
                Selecione os contatos ({selectedContacts.length} selecionados)
              </Label>
              <Button variant="outline" size="sm" onClick={handleSelectAll}>
                {selectedContacts.length === contacts.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </Button>
            </div>

            <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center justify-between p-3 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => handleSelectContact(contact.id)}
                    />
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    </div>
                  </div>
                  {selectedContacts.includes(contact.id) && selectedCampaign && (
                    <Button
                      size="sm"
                      asChild
                      variant="default"
                    >
                      <a
                        href={generateWhatsAppLink(contact, selectedCampaign.message)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Enviar WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <p className="text-sm text-muted-foreground mr-auto">
              Clique em cada botão "Enviar WhatsApp" para abrir o WhatsApp Web com a mensagem pronta
            </p>
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
