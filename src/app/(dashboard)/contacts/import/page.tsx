'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Upload, FileText, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

export default function ImportContactsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<any[]>([]);
  const router = useRouter();
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);

    if (selectedFile.name.endsWith('.csv')) {
      const text = await selectedFile.text();
      const rows = text.split('\n').slice(1);
      const contacts = rows.slice(0, 5).map(row => {
        const [name, phone, email] = row.split(',');
        return { name, phone, email };
      });
      setPreview(contacts);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        toast({
          title: 'Sucesso!',
          description: `${data.imported} contatos importados`,
        });
        router.push('/contacts');
      } else {
        throw new Error('Erro ao importar');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao importar contatos',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Button
        variant="ghost"
        onClick={() => router.push('/contacts')}
        className="mb-4"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Voltar
      </Button>

      <h1 className="text-3xl font-bold mb-6">Importar Contatos</h1>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <FileText className="w-12 h-12 text-blue-500" />
          <div>
            <h3 className="text-xl font-semibold">Arquivo CSV</h3>
            <p className="text-gray-600">
              Formato: nome, telefone, email, categoria
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />

          {preview.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Preview (primeiros 5):</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2 border">Nome</th>
                      <th className="text-left p-2 border">Telefone</th>
                      <th className="text-left p-2 border">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((contact, i) => (
                      <tr key={i}>
                        <td className="p-2 border">{contact.name}</td>
                        <td className="p-2 border">{contact.phone}</td>
                        <td className="p-2 border">{contact.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Button
            onClick={handleImport}
            disabled={!file || importing}
            className="w-full"
          >
            <Upload className="w-4 h-4 mr-2" />
            {importing ? 'Importando...' : 'Importar Contatos'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
