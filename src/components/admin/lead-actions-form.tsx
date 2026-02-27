'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Send, Bot, BotOff } from 'lucide-react';

interface LeadActionsFormProps {
  leadId: string;
  conversationId: string;
  currentStatus: string;
  botActive: boolean;
}

export function LeadActionsForm({
  leadId,
  conversationId,
  currentStatus,
  botActive,
}: LeadActionsFormProps) {
  const [message, setMessage] = useState('');
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [sending, setSending] = useState(false);
  const [isBotActive, setIsBotActive] = useState(botActive);
  const { toast } = useToast();

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: message.trim(),
          newStatus,
        }),
      });
      if (!res.ok) throw new Error('Falha ao enviar');
      setMessage('');
      toast({ title: '✅ Mensagem enviada!', description: 'Lead notificado via WhatsApp.' });
      // Reload para atualizar thread
      window.location.reload();
    } catch {
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  }

  async function handleToggleBot() {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, botActive: !isBotActive }),
      });
      if (!res.ok) throw new Error('Falha');
      setIsBotActive(!isBotActive);
      toast({
        title: isBotActive ? '🤖 Bot pausado' : '🤖 Bot reativado',
        description: isBotActive
          ? 'Você assumiu a conversa. O bot não responderá mais.'
          : 'O bot voltará a responder automaticamente.',
      });
    } catch {
      toast({ title: 'Erro ao alterar modo do bot', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      {/* Toggle bot */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-2 text-sm">
          {isBotActive ? (
            <Bot className="h-4 w-4 text-blue-500" />
          ) : (
            <BotOff className="h-4 w-4 text-slate-400" />
          )}
          <span className="font-medium">
            {isBotActive ? 'Bot ativo — respondendo automaticamente' : 'Bot pausado — modo manual'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleBot}
        >
          {isBotActive ? 'Assumir conversa' : 'Reativar bot'}
        </Button>
      </div>

      {/* Send message form */}
      <form onSubmit={handleSend} className="space-y-4">
        <div className="space-y-2">
          <Label>Mensagem manual</Label>
          <Textarea
            placeholder="Digite uma mensagem para o lead..."
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <div className="flex items-end gap-3">
          <div className="space-y-1 flex-1">
            <Label>Atualizar status do lead</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="contacted">Contactado</SelectItem>
                <SelectItem value="qualified">Qualificado</SelectItem>
                <SelectItem value="converted">Convertido</SelectItem>
                <SelectItem value="lost">Perdido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="submit"
            disabled={sending || !message.trim()}
            className="flex-shrink-0"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </form>
    </div>
  );
}
