'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function RestoreAccountButton({ professionalId }: { professionalId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleRestore() {
    if (!confirm('Restaurar esta conta? A exclusão será cancelada e a página voltará a ficar ativa.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/restore-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ professional_id: professionalId }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error}`);
      }
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <span className="text-xs text-green-600 font-medium">Restaurada ✓</span>;
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRestore} disabled={loading}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
      Restaurar
    </Button>
  );
}
