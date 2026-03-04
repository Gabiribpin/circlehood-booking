'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function WebhookRetryButton({ failureId }: { failureId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRetry() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/webhook-failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ failureId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(`Erro: ${data.error || res.statusText}`);
        return;
      }

      router.refresh();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRetry} disabled={loading}>
      <RotateCcw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
      {loading ? '...' : 'Retry'}
    </Button>
  );
}
