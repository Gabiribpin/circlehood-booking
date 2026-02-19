'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface BotConfig {
  bot_name: string;
  bot_personality: 'friendly' | 'professional' | 'casual';
  auto_book_if_available: boolean;
  always_confirm_booking: boolean;
  ask_for_additional_info: boolean;
  greeting_message: string;
  unavailable_message: string;
  confirmation_message: string;
  custom_system_prompt: string;
  max_context_messages: number;
}

const DEFAULT_CONFIG: BotConfig = {
  bot_name: '',
  bot_personality: 'friendly',
  auto_book_if_available: true,
  always_confirm_booking: false,
  ask_for_additional_info: false,
  greeting_message: '',
  unavailable_message: '',
  confirmation_message: '',
  custom_system_prompt: '',
  max_context_messages: 10,
};

export function BotConfigPanel() {
  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('bot_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setConfig({
          bot_name: data.bot_name ?? '',
          bot_personality: data.bot_personality ?? 'friendly',
          auto_book_if_available: data.auto_book_if_available ?? true,
          always_confirm_booking: data.always_confirm_booking ?? false,
          ask_for_additional_info: data.ask_for_additional_info ?? false,
          greeting_message: data.greeting_message ?? '',
          unavailable_message: data.unavailable_message ?? '',
          confirmation_message: data.confirmation_message ?? '',
          custom_system_prompt: data.custom_system_prompt ?? '',
          max_context_messages: data.max_context_messages ?? 10,
        });
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage({ type: 'error', text: 'Utilizador não autenticado.' });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('bot_config')
      .upsert({
        user_id: user.id,
        bot_name: config.bot_name || null,
        bot_personality: config.bot_personality,
        auto_book_if_available: config.auto_book_if_available,
        always_confirm_booking: config.always_confirm_booking,
        ask_for_additional_info: config.ask_for_additional_info,
        greeting_message: config.greeting_message || null,
        unavailable_message: config.unavailable_message || null,
        confirmation_message: config.confirmation_message || null,
        custom_system_prompt: config.custom_system_prompt || null,
        max_context_messages: config.max_context_messages,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    setMessage(error
      ? { type: 'error', text: `Erro: ${error.message}` }
      : { type: 'success', text: '✅ Configuração do bot salva!' }
    );
    setSaving(false);
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-4">A carregar configuração do bot...</p>;
  }

  return (
    <div className="space-y-6 pt-4 border-t mt-6">
      <h3 className="text-lg font-semibold">🤖 Personalidade do Bot</h3>

      {/* Seção 1: Identidade */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="bot_name">Nome do bot</Label>
          <Input
            id="bot_name"
            placeholder="Ex: Sofia, Maria, Assistente..."
            value={config.bot_name}
            onChange={(e) => setConfig({ ...config, bot_name: e.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Como o bot se apresenta. Se vazio, usa o nome do negócio.
          </p>
        </div>

        <div>
          <Label htmlFor="bot_personality">Personalidade</Label>
          <select
            id="bot_personality"
            value={config.bot_personality}
            onChange={(e) => setConfig({ ...config, bot_personality: e.target.value as BotConfig['bot_personality'] })}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="friendly">😊 Amigável — tom caloroso, emojis moderados</option>
            <option value="professional">💼 Profissional — tom formal, sem emojis</option>
            <option value="casual">🎉 Casual — tom descontraído, emojis livres</option>
          </select>
        </div>
      </div>

      {/* Seção 2: Comportamento */}
      <div>
        <h4 className="font-medium text-sm mb-3">Comportamento de agendamento</h4>
        <div className="space-y-3">
          {[
            {
              key: 'auto_book_if_available' as const,
              title: 'Confirmar agendamento diretamente',
              desc: 'O bot confirma sem dizer "vou verificar disponibilidade"',
            },
            {
              key: 'always_confirm_booking' as const,
              title: 'Pedir confirmação explícita',
              desc: 'Sempre perguntar "Confirma o agendamento?" antes de registrar',
            },
            {
              key: 'ask_for_additional_info' as const,
              title: 'Pedir informações adicionais',
              desc: 'Perguntar sobre tipo de cabelo, sensibilidades, etc.',
            },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 border-b last:border-0">
              <div>
                <p className="font-medium text-sm">{item.title}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
              <Switch
                checked={config[item.key]}
                onCheckedChange={(checked) => setConfig({ ...config, [item.key]: checked })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Seção 3: Mensagens personalizadas */}
      <div>
        <h4 className="font-medium text-sm mb-3">Mensagens personalizadas</h4>
        <div className="space-y-4">
          <div>
            <Label htmlFor="greeting_message">Saudação inicial</Label>
            <Textarea
              id="greeting_message"
              rows={2}
              placeholder="Olá! 👋 Bem-vinda ao salão da Maria! Como posso ajudar?"
              value={config.greeting_message}
              onChange={(e) => setConfig({ ...config, greeting_message: e.target.value })}
            />
            <p className="text-xs text-gray-500 mt-1">Mensagem enviada quando o cliente entra em contato pela primeira vez.</p>
          </div>
          <div>
            <Label htmlFor="unavailable_message">Quando indisponível</Label>
            <Textarea
              id="unavailable_message"
              rows={2}
              placeholder="Infelizmente não temos esse horário disponível. Posso oferecer..."
              value={config.unavailable_message}
              onChange={(e) => setConfig({ ...config, unavailable_message: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="confirmation_message">Confirmação de agendamento</Label>
            <Textarea
              id="confirmation_message"
              rows={2}
              placeholder='Agendado [Nome]! ✅&#10;[Data] [Hora] - [Serviço]&#10;Até logo! 💅'
              value={config.confirmation_message}
              onChange={(e) => setConfig({ ...config, confirmation_message: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Seção 4: Prompt avançado */}
      <div>
        <h4 className="font-medium text-sm mb-1">Prompt do sistema (avançado)</h4>
        <p className="text-xs text-gray-500 mb-2">
          Se preenchido, substitui todo o prompt padrão. Variáveis disponíveis:{' '}
          <code className="bg-gray-100 px-1 rounded text-xs">
            {'{bot_name}'} {'{business_name}'} {'{phone}'} {'{services}'} {'{schedule}'} {'{location}'} {'{conversation_history}'}
          </code>
        </p>
        <Textarea
          id="custom_system_prompt"
          rows={6}
          placeholder="Deixe vazio para usar o prompt padrão gerado automaticamente."
          value={config.custom_system_prompt}
          onChange={(e) => setConfig({ ...config, custom_system_prompt: e.target.value })}
          className="font-mono text-xs"
        />
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'A salvar...' : 'Salvar Configuração do Bot'}
      </Button>
    </div>
  );
}
