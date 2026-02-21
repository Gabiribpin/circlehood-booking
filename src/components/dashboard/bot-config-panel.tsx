'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BotConfig {
  bot_name: string;
  bot_personality: 'friendly' | 'professional';
}

const DEFAULT_CONFIG: BotConfig = {
  bot_name: '',
  bot_personality: 'friendly',
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
        .select('bot_name, bot_personality')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setConfig({
          bot_name: data.bot_name ?? '',
          bot_personality: (data.bot_personality === 'professional' ? 'professional' : 'friendly'),
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
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      setMessage({ type: 'error', text: `Erro: ${error.message}` });
    } else {
      setMessage({ type: 'success', text: '✅ Configuração do bot salva!' });
      setTimeout(() => setMessage(null), 5000);
    }
    setSaving(false);
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-4">A carregar configuração do bot...</p>;
  }

  return (
    <div className="space-y-6 pt-4 border-t mt-6">
      <h3 className="text-lg font-semibold">🤖 Personalidade do Bot</h3>

      <div className="space-y-4">
        <div>
          <Label htmlFor="bot_name">
            Nome do bot
            <span className="ml-2 text-xs text-gray-500 font-normal">(opcional)</span>
          </Label>
          <Input
            id="bot_name"
            placeholder="Ex: Sofia, Maria, Assistente..."
            value={config.bot_name}
            onChange={(e) => setConfig({ ...config, bot_name: e.target.value })}
          />
          <p className="text-xs text-gray-500 mt-1">
            Como o bot se apresenta.{' '}
            {!config.bot_name && (
              <span className="text-blue-600">
                (Atualmente usando nome do negócio como padrão)
              </span>
            )}
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
          </select>
        </div>
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
        {saving ? 'A salvar...' : 'Salvar Configuração'}
      </Button>
    </div>
  );
}
