'use client';

import { useState, useEffect, useRef, useId, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { ArrowLeft, Upload, CheckCircle, AlertTriangle, Download, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneInternational } from '@/lib/utils/phone-detection';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParsedRow {
  name: string;
  phone: string;
  email: string;
  birthday: string;
  notes: string;
  isDuplicate: boolean;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): Omit<ParsedRow, 'isDuplicate'>[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

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
  const birthdayCol = colIndex(['aniversario', 'aniversário', 'birthday', 'nascimento', 'data_nascimento', 'data nascimento']);
  const notesCol = colIndex(['notas', 'notes', 'observacoes', 'observações', 'obs']);

  const rows: Omit<ParsedRow, 'isDuplicate'>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const name = nameCol >= 0 ? cols[nameCol] || '' : cols[0] || '';
    const phone = phoneCol >= 0 ? cols[phoneCol] || '' : cols[1] || '';
    if (!name || !phone) continue;

    // Normalizar data de aniversário: aceita YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    let birthday = birthdayCol >= 0 ? cols[birthdayCol] || '' : '';
    if (birthday) {
      const dmyMatch = birthday.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmyMatch) {
        birthday = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(birthday)) birthday = '';
    }

    rows.push({
      name,
      phone: formatPhoneInternational(phone),
      email: emailCol >= 0 ? cols[emailCol] || '' : '',
      birthday,
      notes: notesCol >= 0 ? cols[notesCol] || '' : '',
    });
  }
  return rows;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ImportCSVPage() {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('clients');
  const tc = useTranslations('common');
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [professionalId, setProfessionalId] = useState('');
  const [existingPhones, setExistingPhones] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [useBotForAll, setUseBotForAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

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

  function processFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      toast({ title: t('invalidFile'), description: t('invalidFileDesc'), variant: 'destructive' });
      return;
    }
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
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    e.target.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [existingPhones]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImport() {
    if (!professionalId || rows.length === 0) return;

    const newRows = rows.filter((r) => !r.isDuplicate);
    if (newRows.length === 0) {
      toast({ title: t('noNewContacts'), description: t('allExist') });
      return;
    }

    setImporting(true);
    const supabase = createClient();

    const toInsert = newRows.map((r) => ({
      professional_id: professionalId,
      name: r.name,
      phone: r.phone,
      email: r.email || null,
      birthday: r.birthday || null,
      notes: r.notes || null,
      use_bot: useBotForAll,
    }));

    const { error } = await supabase.from('contacts').insert(toInsert);
    setImporting(false);

    if (error) {
      toast({ title: t('importError'), description: error.message, variant: 'destructive' });
      return;
    }

    toast({
      title: t('importDone'),
      description: t('importedDesc', { count: newRows.length }),
    });
    router.push('/clients?tab=manage');
  }

  const newCount = rows.filter((r) => !r.isDuplicate).length;
  const dupCount = rows.filter((r) => r.isDuplicate).length;

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/clients?tab=manage')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> {tc('back')}
        </Button>
        <h1 className="text-2xl font-bold">{t('importTitle')}</h1>
      </div>

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> {t('importHowTo')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('importCSVDesc')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="bg-muted rounded-md p-3 space-y-1">
              <p className="font-medium">{t('requiredCols')}</p>
              <p className="text-muted-foreground"><code>nome</code> — nome do contato</p>
              <p className="text-muted-foreground"><code>telefone</code> — com código do país (+55, +353...)</p>
            </div>
            <div className="bg-muted rounded-md p-3 space-y-1">
              <p className="font-medium">{t('optionalCols')}</p>
              <p className="text-muted-foreground"><code>email</code></p>
              <p className="text-muted-foreground"><code>aniversario</code> — formato DD/MM/AAAA ou AAAA-MM-DD</p>
              <p className="text-muted-foreground"><code>notas</code></p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href="/templates/contatos-template.csv" download>
              <Download className="mr-2 h-4 w-4" /> {t('downloadTemplate')}
            </a>
          </Button>
        </CardContent>
      </Card>

      {/* Upload — drag & drop */}
      <Card>
        <CardHeader>
          <CardTitle>1. {t('step1')}</CardTitle>
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

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
              }
            `}
          >
            <Upload className={`mx-auto h-8 w-8 mb-3 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
            {isDragging ? (
              <p className="text-sm font-medium text-primary">{t('dropHere')}</p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  {fileName ? t('fileSelected', { name: fileName }) : t('dropOrClick')}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{t('onlyCsv')}</p>
              </>
            )}
          </div>

          {rows.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => { setRows([]); setFileName(''); }}>
              {t('clearFile')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Preview — {t('previewTitle', { count: rows.length })}</CardTitle>
              <CardDescription className="flex gap-4">
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5" /> {t('newCount', { count: newCount })}
                </span>
                {dupCount > 0 && (
                  <span className="text-yellow-600 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t('dupCount', { count: dupCount })}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('colStatus')}</TableHead>
                      <TableHead>{t('colName')}</TableHead>
                      <TableHead>{t('colPhone')}</TableHead>
                      <TableHead>{t('colEmail')}</TableHead>
                      <TableHead>{t('colBirthday')}</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow key={i} className={row.isDuplicate ? 'opacity-50' : ''}>
                        <TableCell>
                          {row.isDuplicate ? (
                            <span className="flex items-center gap-1 text-yellow-600 text-xs font-medium">
                              <AlertTriangle className="h-3.5 w-3.5" /> {t('statusDuplicate')}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle className="h-3.5 w-3.5" /> {t('statusNew')}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="font-mono text-sm">{row.phone}</TableCell>
                        <TableCell className="text-muted-foreground">{row.email || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.birthday ? formatBirthday(row.birthday) : '-'}
                        </TableCell>
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
              <CardTitle>3. {t('step3')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-3">
                <Switch
                  id="use-bot-all"
                  checked={useBotForAll}
                  onCheckedChange={setUseBotForAll}
                />
                <Label htmlFor="use-bot-all" className="cursor-pointer">
                  <span className="font-medium">{t('botSwitchLabel')}</span>
                  <p className="text-sm text-muted-foreground">
                    {useBotForAll ? t('botSwitchOn') : t('botSwitchOff')}
                  </p>
                </Label>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleImport}
                  disabled={importing || newCount === 0}
                >
                  {importing ? t('importing') : t('importBtn', { count: newCount })}
                </Button>
                <Button variant="outline" onClick={() => router.push('/clients?tab=manage')}>
                  {tc('cancel')}
                </Button>
              </div>

              {newCount === 0 && (
                <p className="text-sm text-yellow-600">{t('allDuplicates')}</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBirthday(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}
