import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { businessName, category, city, country } = await request.json();

  if (!businessName) {
    return NextResponse.json({ error: 'Missing businessName' }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: `Gere uma bio profissional curta (2-3 frases, maximo 200 caracteres) para um profissional autonomo.
Dados:
- Nome do negócio: ${businessName}
- Categoria: ${category || 'Profissional autonomo'}
- Cidade: ${city || ''}
- Pais: ${country || ''}

A bio deve ser em portugues, acolhedora, profissional e destacar o diferencial. Não use emojis. Responda APENAS com o texto da bio, sem aspas.`,
        },
      ],
    });

    const bio =
      message.content[0].type === 'text' ? message.content[0].text.trim() : '';

    return NextResponse.json({ bio });
  } catch {
    return NextResponse.json(
      { error: 'Falha ao gerar bio. Tente novamente.' },
      { status: 500 }
    );
  }
}
