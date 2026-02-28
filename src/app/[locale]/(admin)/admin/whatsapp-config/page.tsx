'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Image from 'next/image';
import { QrCode, Smartphone, Wifi, WifiOff } from 'lucide-react';

type ConnectionStatus = 'idle' | 'loading' | 'qrcode' | 'pairing' | 'connected' | 'error';

export default function AdminWhatsAppConfigPage() {
  const [phone, setPhone] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [instanceName, setInstanceName] = useState('');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // Load initial status
  useEffect(() => {
    async function checkInitialStatus() {
      try {
        const res = await fetch('/api/admin/evolution/check-connection');
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setConnectionStatus('connected');
          }
        }
      } catch {
        // ignore
      }
      setLoading(false);
    }
    checkInitialStatus();
  }, []);

  // Auto-refresh on focus
  useEffect(() => {
    function onFocus() {
      if (connectionStatus === 'connected' || connectionStatus === 'idle') {
        fetch('/api/admin/evolution/check-connection')
          .then(r => r.json())
          .then(data => {
            if (data.connected) setConnectionStatus('connected');
            else if (connectionStatus === 'connected') setConnectionStatus('idle');
          })
          .catch(() => {});
      }
    }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [connectionStatus]);

  async function handleConnect(method: 'qrcode' | 'pairing') {
    if (!phone) {
      setErrorMessage('Informe o número de telefone.');
      setConnectionStatus('error');
      return;
    }

    setConnectionStatus('loading');
    setQrCode(null);
    setPairingCode(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/evolution/create-instance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, method }),
      });

      const data = await res.json();

      if (!res.ok) {
        setConnectionStatus('error');
        setErrorMessage(data.error ?? 'Erro ao criar instância.');
        return;
      }

      setInstanceName(data.instanceName);

      if (method === 'pairing' && data.pairingCode) {
        setPairingCode(data.pairingCode);
        setConnectionStatus('pairing');
        startPolling();
      } else if (data.qrCode) {
        setQrCode(data.qrCode);
        setConnectionStatus('qrcode');
        startPolling();
      } else {
        startPolling();
      }
    } catch {
      setConnectionStatus('error');
      setErrorMessage('Erro de conexão com o servidor.');
    }
  }

  function startPolling() {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        const connRes = await fetch('/api/admin/evolution/check-connection');
        if (connRes.ok) {
          const connData = await connRes.json();
          if (connData.connected) {
            clearInterval(pollingRef.current!);
            pollingRef.current = null;
            setConnectionStatus('connected');
            setQrCode(null);
            setPairingCode(null);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
  }

  function resetConnection() {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setConnectionStatus('idle');
    setQrCode(null);
    setPairingCode(null);
  }

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-slate-500">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">WhatsApp de Vendas</h1>
        <p className="text-sm text-muted-foreground">
          Configure o número de WhatsApp do bot de vendas da CircleHood.
        </p>
      </div>

      <Card className="p-6 space-y-5">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <>
              <Wifi className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-700">Conectado</span>
              {instanceName && (
                <span className="text-xs text-muted-foreground ml-2">({instanceName})</span>
              )}
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-red-500" />
              <span className="text-sm font-medium text-red-600">Desconectado</span>
            </>
          )}
        </div>

        {/* Connected badge */}
        {connectionStatus === 'connected' && (
          <div className="p-3 bg-green-50 border-2 border-green-500 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-2xl">📱</span>
              <div>
                <p className="font-semibold text-green-900">WhatsApp de vendas conectado!</p>
                {phone && (
                  <p className="text-sm text-green-700">Número: {phone}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* QR Code */}
        {connectionStatus === 'qrcode' && qrCode && (
          <div className="p-5 bg-gray-50 border rounded-xl text-center space-y-4">
            <p className="font-semibold text-gray-800">Escaneie o QR Code no WhatsApp</p>
            <div className="flex justify-center">
              <Image
                src={qrCode}
                alt="QR Code WhatsApp"
                width={220}
                height={220}
                className="rounded-lg border"
              />
            </div>
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
              <span className="animate-spin inline-block">🔄</span>
              Aguardando leitura do QR Code...
            </p>
            <p className="text-xs text-gray-400">
              Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho &gt; Escaneie o QR Code
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={resetConnection}>
                Cancelar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleConnect('pairing')}>
                <Smartphone className="h-4 w-4 mr-1.5" />
                Usar Código de Pareamento
              </Button>
            </div>
          </div>
        )}

        {/* Pairing Code */}
        {connectionStatus === 'pairing' && pairingCode && (
          <div className="p-5 bg-blue-50 border-2 border-blue-200 rounded-xl text-center space-y-4">
            <Smartphone className="h-8 w-8 text-blue-600 mx-auto" />
            <p className="font-semibold text-gray-800">Código de Pareamento</p>
            <div className="bg-white border-2 border-blue-300 rounded-xl py-4 px-6 inline-block">
              <p className="text-3xl font-mono font-bold tracking-[0.3em] text-blue-700 select-all">
                {pairingCode}
              </p>
            </div>
            <div className="text-sm text-gray-600 space-y-1 max-w-sm mx-auto text-left">
              <p>1. Abra o WhatsApp no celular</p>
              <p>2. Vá em Aparelhos conectados &gt; Conectar aparelho</p>
              <p>3. Toque em &quot;Conectar com número de telefone&quot; e insira o código acima</p>
            </div>
            <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
              <span className="animate-spin inline-block">🔄</span>
              Aguardando pareamento...
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="outline" size="sm" onClick={resetConnection}>
                Cancelar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleConnect('qrcode')}>
                <QrCode className="h-4 w-4 mr-1.5" />
                Usar QR Code
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {connectionStatus === 'loading' && (
          <div className="p-5 bg-gray-50 border rounded-xl text-center">
            <p className="text-gray-600">Criando instância... Aguarde.</p>
          </div>
        )}

        {/* Reconnect button */}
        {connectionStatus === 'connected' && (
          <Button variant="outline" size="sm" onClick={resetConnection}>
            Reconectar
          </Button>
        )}

        {/* Error */}
        {connectionStatus === 'error' && errorMessage && (
          <div className="p-3 rounded-lg text-sm bg-red-50 text-red-800 border border-red-200">
            {errorMessage}
          </div>
        )}

        {/* Form — phone + connect buttons */}
        {(connectionStatus === 'idle' || connectionStatus === 'error') && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="salesPhone">Número do WhatsApp</Label>
              <Input
                id="salesPhone"
                placeholder="+55 11 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">
                Número com código do país (ex: 5511999999999)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                onClick={() => handleConnect('qrcode')}
                className="w-full bg-green-600 hover:bg-green-700 text-white h-auto py-3"
              >
                <div className="flex flex-col items-center gap-1">
                  <QrCode className="h-5 w-5" />
                  <span className="text-sm font-semibold">Conectar via QR Code</span>
                  <span className="text-[10px] text-green-200 font-normal">Escaneie com o celular</span>
                </div>
              </Button>
              <Button
                onClick={() => handleConnect('pairing')}
                variant="outline"
                className="w-full h-auto py-3 border-blue-200 hover:bg-blue-50"
              >
                <div className="flex flex-col items-center gap-1">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-semibold">Código de Pareamento</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Digite o código no celular</span>
                </div>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
