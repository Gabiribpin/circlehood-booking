'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneInternational } from '@/lib/utils/phone-detection';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  name: string;
  phone: string;
  email: string;
  notes: string;
  isDuplicate: boolean;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): Omit<ParsedRow, 'isDuplicate'>[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Detectar cabeçalho
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''));
  const colIndex = (names: string[]) => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };

  const nameCol = colIndex(['nome', 'name']);
  const phoneCol = colIndex(['telefone', 'phone', 'tel', 'celular', 'whatsapp']);
  const emailCol = colIndex(['email', 'e-mail']);
  const notesCol = colIndex(['notas', 'notes', 'observacoes', 'observações', 'obs']);

  const rows: Omit<ParsedRow, 'isDuplicate'>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const name = nameCol >= 0 ? cols[nameCol] || '' : cols[0] || '';
    const phone = phoneCol >= 0 ? cols[phoneCol] || '' : cols[1] || '';
    if (!name || !phone) continue;
    rows.push({
      name,
      phone: formatPhoneInternational(phone),
      email: emailCol >= 0 ? cols[emailCol] || '' : '',
      notes: notesCol >= 0 ? cols[notesCol] || '' : '',
    });
  }
  return rows;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportCSVPage() {
  const router = useRouter();
  const { toast } = useToast();
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [professionalId, setProfessionalId] = useState('');
  const [existingPhones, setExistingPhones] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [useBotForAll, setUseBotForAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');

  // Auth + carregar phones existentes
  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: professional } = await supabase
        .from('professionals').select('id').eq('user_id', user.id).single();
      if (!professional) return;

      setProfessionalId(professional.id);

      const { data: contacts } = await supabase
        .from('contacts').select('phone').eq('professional_id', professional.id);

      const phones = new Set<string>();
      for (const c of contacts || []) {
        if (c.phone) phones.add(c.phone.replace(/\D/g, ''));
      }
      setExistingPhones(phones);
    }
    init();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);

      const withStatus: ParsedRow[] = parsed.map((row) => ({
        ...row,
        isDuplicate: existingPhones.has(row.phone.replace(/\D/g, '')),
      }));

      setRows(withStatus);
    };
    reader.readAsText(file);

    // Limpar input para permitir reselecionar o mesmo arquivo
    e.target.value = '';
  }

  async function handleImport() {
    if (!professionalId || rows.length === 0) return;

    const newRows = rows.filter((r) => !r.isDuplicate);
    if (newRows.length === 0) {
      toast({ title: 'Nenhum contato novo', description: 'Todos os contatos já existem.' });
      return;
    }

    setImporting(true);
    const supabase = createClient();

    const toInsert = newRows.map((r) => ({
      professional_id: professionalId,
      name: r.name,
      phone: r.phone,
      email: r.email || null,
      notes: r.notes || null,
      use_bot: useBotForAll,
    }));

    const { error } = await supabase.from('contacts').insert(toInsert);
    setImporting(false);

    if (error) {
      toast({ title: 'Erro ao importar', description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: 'Importação concluída!',
      description: `${newRows.length} contato${newRows.length !== 1 ? 's' : ''} importado${newRows.length !== 1 ? 's' : ''}.`,
    });
    router.push('/clients?tab=manage');
  }

  const newCount = rows.filter((r) => !r.isDuplicate).length;
  const dupCount = rows.filter((r) => r.isDuplicate).length;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/clients?tab=manage')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <h1 className="text-2xl font-bold">Importar Contatos via CSV</h1>
      </div>

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle>1. Selecionar arquivo</CardTitle>
          <CardDescription>
            O arquivo deve ter colunas: <code>nome, telefone, email, notas</code> (cabeçalho obrigatório)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            id={fileInputId}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            {fileName ? `Trocar arquivo (${fileName})` : 'Selecionar arquivo CSV'}
          </Button>

          {fileName && (
            <p className="text-sm text-muted-foreground">
              Arquivo: <strong>{fileName}</strong>
            </p>
          )}

          <div className="bg-muted rounded-lg p-3 text-sm">
            <p className="font-medium mb-1">Formato esperado:</p>
            <pre className="text-xs text-muted-foreground">{`nome,telefone,email,notas
Maria Silva,+5511999999999,maria@exemplo.com,Cliente VIP
Ana Costa,+353851234567,,`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Preview — {rows.length} linha{rows.length !== 1 ? 's' : ''} encontrada{rows.length !== 1 ? 's' : ''}</CardTitle>
              <CardDescription className="flex gap-4">
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> {newCount} novo{newCount !== 1 ? 's' : ''}
                </span>
                {dupCount > 0 && (
                  <span className="text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {dupCount} duplicata{dupCount !== 1 ? 's' : ''} (serão ignoradas)
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow key={i} className={row.isDuplicate ? 'opacity-50' : ''}>
                        <TableCell>
                          {row.isDuplicate ? (
                            <span className="flex items-center gap-1 text-yellow-600 text-xs font-medium">
                              <AlertTriangle className="h-3.5 w-3.5" /> Duplicata
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle className="h-3.5 w-3.5" /> Novo
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="font-mono text-sm">{row.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{row.email || '-'}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{row.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Config + Importar */}
          <Card>
            <CardHeader>
              <CardTitle>3. Configurar e importar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="use-bot-all"
                  checked={useBotForAll}
                  onCheckedChange={setUseBotForAll}
                />
                <Label htmlFor="use-bot-all" className="cursor-pointer">
                  <span className="font-medium">Ativar bot para todos os contatos importados</span>
                  <p className="text-sm text-muted-foreground">
                    {useBotForAll
                      ? 'A Rita vai responder automaticamente a esses contatos'
                      : 'Bot desativado — esses contatos não receberão respostas automáticas'}
                  </p>
                </Label>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleImport}
                  disabled={importing || newCount === 0}
                >
                  {importing ? 'Importando...' : `Importar ${newCount} contato${newCount !== 1 ? 's' : ''}`}
                </Button>
                <Button variant="outline" onClick={() => router.push('/clients?tab=manage')}>
                  Cancelar
                </Button>
              </div>

              {newCount === 0 && (
                <p className="text-sm text-yellow-600">
                  Todos os contatos do arquivo já existem na sua base.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
