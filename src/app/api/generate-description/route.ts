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

  const { serviceName, businessName, category } = await request.json();

  if (!serviceName) {
    return NextResponse.json({ error: 'Missing serviceName' }, { status: 400 });
  }

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Gere uma descricao curta e vendedora (1-2 frases, maximo 120 caracteres) para um servico profissional.
Dados:
- Servico: ${serviceName}
- Negocio: ${businessName || ''}
- Categoria: ${category || ''}

A descricao deve ser em portugues, atrativa, e destacar beneficios para o cliente. Nao use emojis. Responda APENAS com o texto, sem aspas.`,
        },
      ],
    });

    const description =
      message.content[0].type === 'text' ? message.content[0].text.trim() : '';

    return NextResponse.json({ description });
  } catch {
    return NextResponse.json(
      { error: 'Falha ao gerar descricao. Tente novamente.' },
      { status: 500 }
    );
  }
}
