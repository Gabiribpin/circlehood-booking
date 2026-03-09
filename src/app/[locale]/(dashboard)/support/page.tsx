'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, ChevronDown, ChevronUp, Send, Bot, User, Shield } from 'lucide-react';

interface Ticket {
  id: string;
  ticket_number?: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'medium' | 'high';
  ai_escalated: boolean;
  created_at: string;
  updated_at: string;
}

interface Reply {
  id: string;
  author: 'client' | 'admin' | 'bot';
  message: string;
  created_at: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'destructive',
  in_progress: 'secondary',
  resolved: 'outline',
};

export default function SupportPage() {
  const t = useTranslations('support');
  const tc = useTranslations('common');
  const locale = useLocale();

  // Build lookup objects using translation function (evaluated once per render)
  const statusLabels: Record<string, string> = {
    open: t('statusOpen'),
    in_progress: t('statusInProgress'),
    resolved: t('statusResolved'),
  };
  const priorityLabels: Record<string, string> = {
    low: t('priorityLow'),
    medium: t('priorityMedium'),
    high: t('priorityHigh'),
  };

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, Reply[]>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // New ticket form
  const [newSubject, setNewSubject] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newPriority, setNewPriority] = useState('medium');

  useEffect(() => {
    fetchTickets();
  }, []);

  async function fetchTickets() {
    setLoading(true);
    try {
      const res = await fetch('/api/support/tickets');
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } catch {
      toast({ title: t('errorLoad'), variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function fetchReplies(ticketId: string) {
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/replies`);
      const data = await res.json();
      setReplies((prev) => ({ ...prev, [ticketId]: data.replies ?? [] }));
    } catch {
      // ignore
    }
  }

  function toggleTicket(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      if (!replies[id]) fetchReplies(id);
    }
  }

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: newSubject,
          message: newMessage,
          priority: newPriority,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast({ title: t('ticketOpened'), description: t('replyShortly') });
      setShowNewTicket(false);
      setNewSubject('');
      setNewMessage('');
      setNewPriority('medium');
      await fetchTickets();
      // Auto-expand the new ticket to show bot response
      if (data.ticket?.id) {
        setTimeout(() => {
          setExpandedId(data.ticket.id);
          fetchReplies(data.ticket.id);
        }, 1500);
      }
    } catch {
      toast({ title: t('errorOpen'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendReply(ticketId: string) {
    const msg = replyText[ticketId]?.trim();
    if (!msg) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticketId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error();
      setReplyText((prev) => ({ ...prev, [ticketId]: '' }));
      await fetchReplies(ticketId);
      await fetchTickets();
    } catch {
      toast({ title: t('errorReply'), variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('subtitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('slaHint')}</p>
        </div>
        <Button onClick={() => setShowNewTicket(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('newTicket')}
        </Button>
      </div>

      {/* Ticket list */}
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : tickets.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">{t('noTickets')}</p>
          <Button onClick={() => setShowNewTicket(true)}>{t('firstTicket')}</Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="overflow-hidden">
              <div
                className="p-4 cursor-pointer hover:bg-accent/30 transition-colors"
                onClick={() => toggleTicket(ticket.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant={STATUS_VARIANT[ticket.status]}>
                        {statusLabels[ticket.status] ?? ticket.status}
                      </Badge>
                      {ticket.ticket_number && (
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {ticket.ticket_number}
                        </code>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {t('priorityLabel')} {priorityLabels[ticket.priority] ?? ticket.priority}
                      </span>
                      {ticket.ai_escalated && (
                        <span className="text-xs text-blue-600">{t('teamNotified')}</span>
                      )}
                    </div>
                    <p className="font-medium text-sm truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t('updatedAt')}{' '}
                      {new Date(ticket.updated_at).toLocaleDateString(locale, {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-muted-foreground">
                    {expandedId === ticket.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded thread */}
              {expandedId === ticket.id && (
                <div className="border-t bg-muted/20 p-4 space-y-4">
                  {/* Replies */}
                  <div className="space-y-3">
                    {(replies[ticket.id] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t('waitingReply')}</p>
                    ) : (
                      (replies[ticket.id] ?? []).map((reply) => (
                        <div
                          key={reply.id}
                          className={`flex gap-3 ${reply.author === 'client' ? 'flex-row-reverse' : ''}`}
                        >
                          <div
                            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs ${
                              reply.author === 'bot'
                                ? 'bg-blue-500'
                                : reply.author === 'admin'
                                  ? 'bg-slate-700'
                                  : 'bg-primary'
                            }`}
                          >
                            {reply.author === 'bot' ? (
                              <Bot className="h-3.5 w-3.5" />
                            ) : reply.author === 'admin' ? (
                              <Shield className="h-3.5 w-3.5" />
                            ) : (
                              <User className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <div
                            className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                              reply.author === 'client'
                                ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                : reply.author === 'bot'
                                  ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-tl-sm'
                                  : 'bg-background border rounded-tl-sm'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 mb-1 opacity-70">
                              <span className="text-[10px] font-medium">
                                {reply.author === 'bot'
                                  ? t('authorBot')
                                  : reply.author === 'admin'
                                    ? t('authorAdmin')
                                    : t('authorYou')}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{reply.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Reply input (only if not resolved) */}
                  {ticket.status !== 'resolved' && (
                    <div className="flex gap-2 pt-2">
                      <Textarea
                        placeholder={t('replyPlaceholder')}
                        className="resize-none text-sm"
                        rows={2}
                        value={replyText[ticket.id] ?? ''}
                        onChange={(e) =>
                          setReplyText((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendReply(ticket.id);
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        onClick={() => handleSendReply(ticket.id)}
                        disabled={submitting || !replyText[ticket.id]?.trim()}
                        className="self-end"
                        aria-label={t('sendReply')}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {ticket.status === 'resolved' && (
                    <p className="text-xs text-green-600 text-center">
                      {t('ticketResolved')}
                    </p>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* New ticket dialog */}
      <Dialog open={showNewTicket} onOpenChange={setShowNewTicket}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('openNewTicketTitle')}</DialogTitle>
            <DialogDescription>{t('openNewTicketDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">{t('subjectLabel')} *</Label>
              <Input
                id="subject"
                placeholder={t('subjectPlaceholder')}
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">{t('prioritySelectLabel')}</Label>
              <Select value={newPriority} onValueChange={setNewPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t('priorityLow')}</SelectItem>
                  <SelectItem value="medium">{t('priorityMedium')}</SelectItem>
                  <SelectItem value="high">{t('priorityHigh')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">{t('descriptionLabel')} *</Label>
              <Textarea
                id="message"
                placeholder={t('descriptionPlaceholder')}
                rows={4}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? t('opening') : t('openTicket')}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNewTicket(false)}>
                {tc('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
