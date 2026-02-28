'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Send } from 'lucide-react';

interface TicketReplyFormProps {
  ticketId: string;
  currentStatus: string;
}

export function TicketReplyForm({ ticketId, currentStatus }: TicketReplyFormProps) {
  const [message, setMessage] = useState('');
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim(), newStatus }),
      });
      if (!res.ok) throw new Error('Falha ao enviar');
      setMessage('');
      toast({ title: '✅ Resposta enviada!', description: 'O cliente foi notificado por email.' });
      onReplySent();
    } catch {
      toast({ title: 'Erro ao enviar resposta', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Resposta</Label>
        <Textarea
          placeholder="Digite sua resposta para o cliente..."
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </div>
      <div className="flex items-end gap-3">
        <div className="space-y-1 flex-1">
          <Label>Atualizar status</Label>
          <Select value={newStatus} onValueChange={setNewStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={sending || !message.trim()} className="flex-shrink-0">
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Enviando...' : 'Enviar resposta'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O cliente receberá uma notificação por email com sua resposta.
      </p>
    </form>
  );
}
