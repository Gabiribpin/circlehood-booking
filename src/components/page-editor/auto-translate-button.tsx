'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles } from 'lucide-react';

interface AutoTranslateButtonProps {
  content: string;
  fromLanguage?: string;
  onTranslated: (translations: Record<string, string>) => void;
}

export function AutoTranslateButton({
  content,
  fromLanguage = 'pt',
  onTranslated,
}: AutoTranslateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleTranslate() {
    if (!content.trim()) return;

    setLoading(true);
    setDone(false);

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          from: fromLanguage,
          to: ['en', 'ro', 'ar', 'es'],
        }),
      });

      if (!response.ok) throw new Error('Translation failed');

      const translations = await response.json();
      onTranslated(translations);
      setDone(true);

      // Reset done state after 3 seconds
      setTimeout(() => setDone(false), 3000);
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={handleTranslate}
      disabled={loading || !content.trim()}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {loading ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Traduzindo...
        </>
      ) : done ? (
        <>
          <Sparkles className="h-3.5 w-3.5 text-green-500" />
          Traduzido!
        </>
      ) : (
        <>
          <Sparkles className="h-3.5 w-3.5" />
          Traduzir Automaticamente
        </>
      )}
    </Button>
  );
}
