'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Loader2,
  Sparkles,
  Save,
  ExternalLink,
  MapPin,
  Clock,
  MessageCircle,
  Instagram,
  Phone,
} from 'lucide-react';
import type { Professional, Service } from '@/types/database';

interface MyPageEditorProps {
  professional: Professional;
  services: Service[];
}

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '\u20AC', GBP: '\u00A3', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(price).toFixed(0)}`;
}

export function MyPageEditor({ professional, services }: MyPageEditorProps) {
  const router = useRouter();
  const supabase = createClient();

  const [bio, setBio] = useState(professional.bio || '');
  const [phone, setPhone] = useState(professional.phone || '');
  const [whatsapp, setWhatsapp] = useState(professional.whatsapp || '');
  const [instagram, setInstagram] = useState(professional.instagram || '');
  const [address, setAddress] = useState(professional.address || '');
  const [saving, setSaving] = useState(false);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await supabase
      .from('professionals')
      .update({
        bio: bio || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        instagram: instagram || null,
        address: address || null,
      })
      .eq('id', professional.id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  async function generateBio() {
    setGeneratingBio(true);
    try {
      const res = await fetch('/api/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: professional.business_name,
          category: professional.category,
          city: professional.city,
          country: professional.country,
        }),
      });
      const data = await res.json();
      if (data.bio) setBio(data.bio);
    } catch {
      // silently fail
    }
    setGeneratingBio(false);
  }

  const initials = professional.business_name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minha Pagina</h1>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <a
            href={`/${professional.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Ver ao vivo
          </a>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informacoes da pagina</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="bio">Bio</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={generateBio}
                    disabled={generatingBio}
                    className="gap-1 text-xs h-7"
                  >
                    {generatingBio ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Gerar com IA
                  </Button>
                </div>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte um pouco sobre voce e seu trabalho..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <PhoneInput
                  value={phone}
                  onChange={(value) => setPhone(value || '')}
                  placeholder="Digite seu telefone"
                  defaultCountry="IE"
                />
                <p className="text-xs text-muted-foreground">
                  Telefone de contato (qualquer país)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <PhoneInput
                  value={whatsapp}
                  onChange={(value) => setWhatsapp(value || '')}
                  placeholder="Digite seu WhatsApp"
                  defaultCountry="IE"
                />
                <p className="text-xs text-muted-foreground">
                  Para clientes entrarem em contato via WhatsApp
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="@seuperfil"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereco</Label>
                <Input
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, numero, cidade"
                />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saved ? 'Salvo!' : 'Salvar alteracoes'}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-hidden bg-background">
                {/* Mini hero */}
                <div className="h-24 bg-gradient-to-br from-primary/80 to-primary/40" />
                <div className="px-4 -mt-10 relative z-10">
                  <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                    <AvatarImage
                      src={professional.profile_image_url || undefined}
                      alt={professional.business_name}
                    />
                    <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="mt-2 pb-4">
                    <h2 className="text-lg font-bold">{professional.business_name}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {professional.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {professional.category}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {professional.city}
                      </span>
                    </div>
                    {bio && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        {bio}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Mini services */}
                <div className="p-4">
                  <h3 className="text-sm font-semibold mb-2">Servicos</h3>
                  {services.filter((s) => s.is_active).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhum servico ativo.</p>
                  ) : (
                    <div className="space-y-2">
                      {services
                        .filter((s) => s.is_active)
                        .slice(0, 3)
                        .map((s) => (
                          <div
                            key={s.id}
                            className="flex items-center justify-between p-2 rounded border text-xs"
                          >
                            <div>
                              <span className="font-medium">{s.name}</span>
                              <span className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                {s.duration_minutes} min
                              </span>
                            </div>
                            <span className="font-semibold">
                              {formatPrice(s.price, professional.currency)}
                            </span>
                          </div>
                        ))}
                      {services.filter((s) => s.is_active).length > 3 && (
                        <p className="text-[10px] text-muted-foreground text-center">
                          +{services.filter((s) => s.is_active).length - 3} servicos
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Mini contact */}
                <div className="p-4 flex flex-wrap gap-2">
                  {whatsapp && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border rounded px-2 py-1">
                      <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                    </span>
                  )}
                  {instagram && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border rounded px-2 py-1">
                      <Instagram className="h-2.5 w-2.5" /> Instagram
                    </span>
                  )}
                  {phone && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border rounded px-2 py-1">
                      <Phone className="h-2.5 w-2.5" /> Telefone
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
