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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RegionSelector } from '@/components/clients/region-selector';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Send, Loader2 } from 'lucide-react';

const DEFAULT_MESSAGE = (region: string, time: string) =>
  `Olá! Estou em ${region || '[região]'} hoje e tenho horário disponível às ${time || '[hora]'}. Gostaria de agendar? 😊`;

export function RegionBroadcast() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [availableTime, setAvailableTime] = useState('');
  const [message, setMessage] = useState('');
  const [recipientsCount, setRecipientsCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [professionalId, setProfessionalId] = useState<string>('');

  // Load professional ID once
  useEffect(() => {
    async function loadProfessional() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: professional } = await supabase
        .from('professionals')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (professional) setProfessionalId(professional.id);
    }
    loadProfessional();
  }, []);

  // Update default message when region/time changes
  useEffect(() => {
    const regionLabel = selectedRegions.length === 1
      ? selectedRegions[0]
      : selectedRegions.length > 1
        ? selectedRegions.join(', ')
        : '';
    setMessage(DEFAULT_MESSAGE(regionLabel, availableTime));
  }, [selectedRegions, availableTime]);

  // Count recipients when regions change
  useEffect(() => {
    if (!selectedRegions.length || !professionalId) {
      setRecipientsCount(0);
      return;
    }
    async function countRecipients() {
      const supabase = createClient();
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', professionalId)
        .overlaps('regions', selectedRegions);
      setRecipientsCount(count || 0);
    }
    countRecipients();
  }, [selectedRegions, professionalId]);

  function resetForm() {
    setSelectedRegions([]);
    setAvailableTime('');
    setMessage('');
    setRecipientsCount(0);
  }

  async function handleBroadcast() {
    if (!selectedRegions.length || !message.trim() || !professionalId) return;

    setSending(true);

    try {
      const supabase = createClient();

      // Save broadcast record
      const { error } = await supabase.from('region_broadcasts').insert({
        professional_id: professionalId,
        region: selectedRegions.join(', '),
        message: message.trim(),
        available_time: availableTime || null,
        recipients_count: recipientsCount,
        status: 'sent',
        metadata: { regions: selectedRegions },
      });

      if (error) throw error;

      toast({
        title: '📍 Broadcast enviado!',
        description: `Mensagem enviada para ${recipientsCount} cliente${recipientsCount !== 1 ? 's' : ''} ${selectedRegions.length === 1 ? `de ${selectedRegions[0]}` : 'das regiões selecionadas'}.`,
      });

      setOpen(false);
      resetForm();
    } catch (err) {
      console.error('Broadcast error:', err);
      toast({
        title: 'Erro ao enviar',
        description: 'Não foi possível enviar o broadcast. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  }

  const canSend = selectedRegions.length > 0 && message.trim() && !sending;

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-green-600 hover:bg-green-700 gap-2"
      >
        <MapPin className="h-4 w-4" />
        Estou na região
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-green-600" />
              Notificar Clientes por Região
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {/* Region selector */}
            <RegionSelector
              value={selectedRegions}
              onChange={setSelectedRegions}
              label="Em qual região você está?"
            />

            {/* Time input */}
            <div className="space-y-1.5">
              <Label htmlFor="available-time">Horário disponível</Label>
              <Input
                id="available-time"
                type="time"
                value={availableTime}
                onChange={(e) => setAvailableTime(e.target.value)}
                className="w-36"
              />
            </div>

            {/* Message */}
            <div className="space-y-1.5">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Olá! Estou na região e tenho horário disponível..."
              />
              <p className="text-xs text-muted-foreground">
                Personalize a mensagem como quiser
              </p>
            </div>

            {/* Preview */}
            <div className={`rounded-lg p-4 border-2 transition-colors ${recipientsCount > 0 ? 'bg-green-50 border-green-200' : 'bg-muted border-muted'}`}>
              {selectedRegions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center">
                  Selecione ao menos uma região para ver o alcance
                </p>
              ) : recipientsCount > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-green-800">
                    ✅ {recipientsCount} cliente{recipientsCount !== 1 ? 's' : ''} receberá{recipientsCount !== 1 ? 'ão' : ''} esta mensagem
                  </p>
                  <p className="text-xs text-green-700">
                    Regiões: {selectedRegions.join(', ')}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Nenhum cliente cadastrado em {selectedRegions.join(', ')}
                </p>
              )}
            </div>

            {/* Send button */}
            <Button
              onClick={handleBroadcast}
              disabled={!canSend}
              className="w-full gap-2 bg-green-600 hover:bg-green-700"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Enviar para {recipientsCount > 0 ? `${recipientsCount} cliente${recipientsCount !== 1 ? 's' : ''}` : 'clientes'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
