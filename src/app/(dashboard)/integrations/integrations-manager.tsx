'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  MessageCircle,
  Instagram,
  Mail,
  CreditCard,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';

interface Integration {
  integration_type: string;
  is_active: boolean;
  is_configured: boolean;
  last_sync_at?: string;
  last_error?: string;
  settings?: any;
}

interface IntegrationsManagerProps {
  professional: any;
  integrations: Integration[];
}

const INTEGRATION_CONFIGS = {
  google_calendar: {
    name: 'Google Calendar',
    description: 'Sincronize agendamentos automaticamente',
    icon: Calendar,
    color: 'blue',
    canConnect: true,
  },
  whatsapp_api: {
    name: 'WhatsApp Business API',
    description: 'Envio automático de mensagens (€0.01/msg)',
    icon: MessageCircle,
    color: 'green',
    canConnect: false, // Requer configuração manual
  },
  instagram: {
    name: 'Instagram',
    description: 'Posts automáticos de vagas e promoções',
    icon: Instagram,
    color: 'pink',
    canConnect: false, // Coming soon
  },
  google_maps: {
    name: 'Google Maps',
    description: 'Mapa interativo na sua página pública',
    icon: MapPin,
    color: 'red',
    canConnect: true,
  },
  email_marketing: {
    name: 'Email Marketing',
    description: 'Campanhas profissionais via Resend',
    icon: Mail,
    color: 'purple',
    canConnect: false, // Coming soon
  },
  revolut: {
    name: 'Revolut Business',
    description: 'Pagamentos alternativos (1-2% taxa)',
    icon: CreditCard,
    color: 'gray',
    canConnect: false, // Coming soon
  },
};

export function IntegrationsManager({ professional, integrations }: IntegrationsManagerProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Transformar array em map
  const integrationsMap: Record<string, Integration> = {};
  integrations.forEach((int) => {
    integrationsMap[int.integration_type] = int;
  });

  const handleConnect = async (type: string) => {
    if (type === 'google_calendar') {
      window.location.href = '/api/integrations/google-calendar/connect';
    } else if (type === 'google_maps') {
      // TODO: Implementar modal de busca de endereço
      alert('Google Maps - Em breve!');
    }
  };

  const handleDisconnect = async (type: string) => {
    if (!confirm('Deseja desconectar esta integração?')) {
      return;
    }

    setLoading(type);

    try {
      const res = await fetch(`/api/integrations/${type}/disconnect`, {
        method: 'POST',
      });

      if (res.ok) {
        window.location.reload();
      } else {
        alert('Erro ao desconectar');
      }
    } catch (error) {
      alert('Erro ao desconectar');
    } finally {
      setLoading(null);
    }
  };

  const handleToggle = async (type: string, newState: boolean) => {
    setLoading(type);

    try {
      const res = await fetch(`/api/integrations/${type}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newState }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        alert('Erro ao atualizar');
      }
    } catch (error) {
      alert('Erro ao atualizar');
    } finally {
      setLoading(null);
    }
  };

  const handleSync = async (type: string) => {
    setSyncing(type);

    try {
      const res = await fetch(`/api/integrations/${type}/sync`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        alert(
          `Sincronização concluída!\n${JSON.stringify(data.result, null, 2)}`
        );
        window.location.reload();
      } else {
        alert(`Erro: ${data.message || 'Falha na sincronização'}`);
      }
    } catch (error) {
      alert('Erro ao sincronizar');
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="text-gray-600 mt-1">
          Conecte suas ferramentas favoritas para automatizar seu negócio
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {Object.entries(INTEGRATION_CONFIGS).map(([type, config]) => {
          const integration = integrationsMap[type];
          const Icon = config.icon;

          return (
            <Card key={type} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 bg-${config.color}-100 rounded-lg`}>
                    <Icon className={`w-6 h-6 text-${config.color}-600`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{config.name}</h3>
                    <p className="text-sm text-gray-600">{config.description}</p>
                  </div>
                </div>

                {integration?.is_configured && (
                  <Switch
                    checked={integration.is_active}
                    onCheckedChange={(checked) => handleToggle(type, checked)}
                    disabled={loading === type}
                  />
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                {integration?.is_configured ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">
                      Conectado
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <span className="text-sm text-orange-600 font-medium">
                      Não configurado
                    </span>
                  </>
                )}
              </div>

              {integration?.last_sync_at && (
                <p className="text-xs text-gray-500 mb-4">
                  Última sincronização:{' '}
                  {new Date(integration.last_sync_at).toLocaleString('pt-BR')}
                </p>
              )}

              {integration?.last_error && (
                <div className="mb-4 p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600">
                    Erro: {integration.last_error}
                  </p>
                </div>
              )}

              {!integration?.is_configured ? (
                <Button
                  onClick={() => handleConnect(type)}
                  className="w-full"
                  disabled={!config.canConnect || loading === type}
                >
                  {loading === type ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Conectando...
                    </>
                  ) : config.canConnect ? (
                    `Conectar ${config.name}`
                  ) : (
                    'Em breve'
                  )}
                </Button>
              ) : (
                <div className="flex gap-2">
                  {type === 'google_calendar' && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSync(type)}
                      disabled={syncing === type}
                    >
                      {syncing === type ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Sincronizar
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    className={type === 'google_calendar' ? 'flex-1' : 'w-full'}
                    onClick={() => handleDisconnect(type)}
                    disabled={loading === type}
                  >
                    {loading === type ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Desconectando...
                      </>
                    ) : (
                      'Desconectar'
                    )}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Instruções */}
      <Card className="mt-8 p-6 bg-blue-50">
        <h3 className="text-lg font-semibold mb-2">ℹ️ Como usar</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Google Calendar:</strong> Clique em "Conectar" e autorize o
            acesso. Seus agendamentos serão sincronizados automaticamente.
          </p>
          <p>
            <strong>WhatsApp Business API:</strong> Requer aprovação da Meta
            Business Suite (1-2 semanas). Custo: ~€0.01/mensagem.
          </p>
          <p>
            <strong>Outras integrações:</strong> Em breve! Fique atento às
            atualizações.
          </p>
        </div>
      </Card>
    </div>
  );
}
