'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Edit, Upload, Search, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { RegionSelector } from '@/components/clients/region-selector';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  category?: string;
  notes?: string;
  regions?: string[];
  created_at: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [professionalId, setProfessionalId] = useState<string>('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [notes, setNotes] = useState('');
  const [regions, setRegions] = useState<string[]>([]);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
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

    // Load contacts
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('professional_id', professional.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erro ao carregar contatos',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    setContacts(data || []);
    setLoading(false);
  }

  async function handleSaveContact() {
    if (!name || !phone) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Nome e telefone são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    const supabase = createClient();

    if (editingContact) {
      // Update
      const { error } = await supabase
        .from('contacts')
        .update({
          name,
          phone,
          email: email || null,
          category: category || null,
          notes: notes || null,
          regions: regions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingContact.id);

      if (error) {
        toast({
          title: 'Erro ao atualizar',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Contato atualizado!',
        description: 'O contato foi atualizado com sucesso.',
      });
    } else {
      // Insert
      const { error } = await supabase
        .from('contacts')
        .insert({
          professional_id: professionalId,
          name,
          phone,
          email: email || null,
          category: category || null,
          notes: notes || null,
          regions: regions,
        });

      if (error) {
        toast({
          title: 'Erro ao adicionar',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Contato adicionado!',
        description: 'O contato foi adicionado com sucesso.',
      });
    }

    resetForm();
    setIsAddDialogOpen(false);
    loadContacts();
  }

  async function handleDeleteContact(id: string) {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;

    const supabase = createClient();
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Contato excluído!',
      description: 'O contato foi excluído com sucesso.',
    });

    loadContacts();
  }

  function handleEditContact(contact: Contact) {
    setEditingContact(contact);
    setName(contact.name);
    setPhone(contact.phone);
    setEmail(contact.email || '');
    setCategory(contact.category || '');
    setNotes(contact.notes || '');
    setRegions(contact.regions || []);
    setIsAddDialogOpen(true);
  }

  function resetForm() {
    setEditingContact(null);
    setName('');
    setPhone('');
    setEmail('');
    setCategory('');
    setNotes('');
    setRegions([]);
  }

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const supabase = createClient();

      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [name, phone, email, category] = line.split(',').map(s => s.trim());
        if (!name || !phone) continue;

        const { error } = await supabase
          .from('contacts')
          .insert({
            professional_id: professionalId,
            name,
            phone,
            email: email || null,
            category: category || null,
          });

        if (!error) imported++;
      }

      toast({
        title: 'Importação concluída!',
        description: `${imported} contatos importados com sucesso.`,
      });

      loadContacts();
    };

    reader.readAsText(file);
  }

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-8">Carregando...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Meus Contatos</h1>
          <p className="text-muted-foreground">
            Gerencie seus contatos para campanhas de marketing
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/contacts/import')}
          >
            <Upload className="mr-2 h-4 w-4" />
            Importar Contatos
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Contato
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingContact ? 'Editar Contato' : 'Adicionar Contato'}
                </DialogTitle>
                <DialogDescription>
                  Preencha os dados do contato abaixo
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Maria Silva"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone *</Label>
                  <PhoneInput
                    value={phone}
                    onChange={(value) => setPhone(value || '')}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="maria@exemplo.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex: Unhas, Cabelo, Bolo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações sobre este contato"
                    rows={3}
                  />
                </div>

                <RegionSelector
                  value={regions}
                  onChange={setRegions}
                  label="Regiões de Dublin"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsAddDialogOpen(false);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveContact}>
                  {editingContact ? 'Atualizar' : 'Adicionar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <CardTitle>
                {filteredContacts.length} {filteredContacts.length === 1 ? 'Contato' : 'Contatos'}
              </CardTitle>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contatos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">Nenhum contato ainda</h3>
              <p className="text-muted-foreground mt-2">
                Adicione seus primeiros contatos para começar campanhas
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.phone}</TableCell>
                    <TableCell>{contact.email || '-'}</TableCell>
                    <TableCell>{contact.category || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditContact(contact)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteContact(contact.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
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
          <CardDescription>
            Formato do arquivo CSV (primeira linha é o cabeçalho):
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-sm">
{`nome,telefone,email,categoria
Maria Silva,+5511999999999,maria@exemplo.com,Unhas
Ana Costa,+5511988888888,ana@exemplo.com,Cabelo
Juliana Lima,+5511977777777,ju@exemplo.com,Bolo`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
