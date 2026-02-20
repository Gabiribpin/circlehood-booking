import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const { text, from, to } = await request.json();

    if (!text || !from || !to) {
      return Response.json(
        { error: 'Missing required fields: text, from, to' },
        { status: 400 }
      );
    }

    const targetLanguages: string[] = Array.isArray(to) ? to : [to];

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    const results = await Promise.all(
      targetLanguages.map(async (targetLang) => {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: `Translate this text from ${from} to ${targetLang}.
Keep the same tone and style. Preserve any {variables} exactly as they are.
If the text contains HTML tags, preserve them exactly — only translate the visible text content inside the tags.
Return ONLY the translated text, with no explanations or extra comments.

Text to translate:
${text}

Translation:`,
            },
          ],
        });
        return {
          lang: targetLang,
          text: response.content[0].type === 'text' ? response.content[0].text.trim() : '',
        };
      })
    );

    const translations: Record<string, string> = {};
    results.forEach(({ lang, text: t }) => { translations[lang] = t; });

    return Response.json(translations);
  } catch (error) {
    console.error('Translation error:', error);
    return Response.json({ error: 'Translation failed' }, { status: 500 });
  }
}
