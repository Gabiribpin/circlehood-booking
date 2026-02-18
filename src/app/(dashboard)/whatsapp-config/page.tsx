'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WhatsAppConfigPage() {
  const [config, setConfig] = useState({
    phoneNumberId: '',
    accessToken: '',
    businessPhone: '',
    isActive: false
  });

  const [aiSettings, setAiSettings] = useState({
    languages: ['pt', 'en'],
    instructions: '',
    welcomeMessage: '',
    autoReminders: true,
    autoBirthdays: true,
    autoWaitlist: true
  });

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">⚙️ Configuração WhatsApp Business</h1>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList>
          <TabsTrigger value="setup">Conexão</TabsTrigger>
          <TabsTrigger value="ai">IA & Automações</TabsTrigger>
          <TabsTrigger value="templates">Mensagens</TabsTrigger>
        </TabsList>

        {/* Tab 1: Setup/Conexão */}
        <TabsContent value="setup">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">1️⃣ Conectar WhatsApp Business</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Número do WhatsApp Business</Label>
                <Input
                  id="phone"
                  placeholder="+353 85 123 4567"
                  value={config.businessPhone}
                  onChange={(e) => setConfig({...config, businessPhone: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="phoneNumberId">Phone Number ID</Label>
                <Input
                  id="phoneNumberId"
                  placeholder="Obtido no Facebook Developer"
                  value={config.phoneNumberId}
                  onChange={(e) => setConfig({...config, phoneNumberId: e.target.value})}
                />
              </div>

              <div>
                <Label htmlFor="accessToken">Access Token</Label>
                <Input
                  id="accessToken"
                  type="password"
                  placeholder="Token permanente do WhatsApp Business API"
                  value={config.accessToken}
                  onChange={(e) => setConfig({...config, accessToken: e.target.value})}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={config.isActive}
                  onCheckedChange={(checked) => setConfig({...config, isActive: checked})}
                />
                <Label htmlFor="active">Ativar WhatsApp Bot</Label>
              </div>

              <Button className="w-full">Salvar Configuração</Button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>📚 Como configurar:</strong><br/>
                1. Acesse <a href="https://developers.facebook.com" className="underline">Facebook Developer</a><br/>
                2. Crie um app WhatsApp Business<br/>
                3. Copie o Phone Number ID e Access Token<br/>
                4. Cole aqui e ative o bot
              </p>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: IA & Automações */}
        <TabsContent value="ai">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">🤖 Configuração da IA</h2>

            <div className="space-y-6">
              {/* Idiomas */}
              <div>
                <Label className="mb-2 block">Idiomas que atende</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { code: 'pt', label: '🇧🇷 Português' },
                    { code: 'en', label: '🇬🇧 English' },
                    { code: 'ro', label: '🇷🇴 Română' },
                    { code: 'ar', label: '🇸🇦 العربية' },
                    { code: 'es', label: '🇪🇸 Español' }
                  ].map(lang => (
                    <label key={lang.code} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={aiSettings.languages.includes(lang.code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAiSettings({
                              ...aiSettings,
                              languages: [...aiSettings.languages, lang.code]
                            });
                          } else {
                            setAiSettings({
                              ...aiSettings,
                              languages: aiSettings.languages.filter(l => l !== lang.code)
                            });
                          }
                        }}
                      />
                      <span>{lang.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Instruções personalizadas */}
              <div>
                <Label htmlFor="instructions">Instruções para a IA</Label>
                <Textarea
                  id="instructions"
                  rows={6}
                  placeholder="Exemplo:&#10;- Seja sempre educado e use emojis&#10;- Mencione promoções quando relevante&#10;- Pergunte se o cliente tem alguma preferência especial"
                  value={aiSettings.instructions}
                  onChange={(e) => setAiSettings({...aiSettings, instructions: e.target.value})}
                />
                <p className="text-sm text-gray-500 mt-1">
                  A IA seguirá estas instruções ao conversar com seus clientes
                </p>
              </div>

              {/* Mensagem de boas-vindas */}
              <div>
                <Label htmlFor="welcome">Mensagem de boas-vindas</Label>
                <Textarea
                  id="welcome"
                  rows={3}
                  placeholder="Olá! 👋 Bem-vindo(a) à {business_name}! Como posso te ajudar hoje?"
                  value={aiSettings.welcomeMessage}
                  onChange={(e) => setAiSettings({...aiSettings, welcomeMessage: e.target.value})}
                />
              </div>

              {/* Automações */}
              <div className="space-y-3">
                <Label>Automações</Label>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Lembretes automáticos</p>
                    <p className="text-sm text-gray-500">Enviar lembrete 24h antes do agendamento</p>
                  </div>
                  <Switch
                    checked={aiSettings.autoReminders}
                    onCheckedChange={(checked) => setAiSettings({...aiSettings, autoReminders: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Mensagens de aniversário</p>
                    <p className="text-sm text-gray-500">Parabenizar clientes automaticamente</p>
                  </div>
                  <Switch
                    checked={aiSettings.autoBirthdays}
                    onCheckedChange={(checked) => setAiSettings({...aiSettings, autoBirthdays: checked})}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Lista de espera automática</p>
                    <p className="text-sm text-gray-500">Notificar quando houver vaga disponível</p>
                  </div>
                  <Switch
                    checked={aiSettings.autoWaitlist}
                    onCheckedChange={(checked) => setAiSettings({...aiSettings, autoWaitlist: checked})}
                  />
                </div>
              </div>

              <Button className="w-full">Salvar Configurações</Button>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Templates de Mensagem */}
        <TabsContent value="templates">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">💬 Templates de Mensagem</h2>

            <p className="text-sm text-gray-600 mb-4">
              Personalize as mensagens automáticas que serão enviadas
            </p>

            {/* Lista de templates editáveis */}
            {/* Implementar editor de templates */}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
