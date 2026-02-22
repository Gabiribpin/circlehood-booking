import Anthropic from '@anthropic-ai/sdk';

export async function detectLanguage(text: string): Promise<string> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!
  });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 50,
    messages: [{
      role: 'user',
      content: `Detect the language of this text and respond with ONLY the 2-letter language code (pt, en, ro, ar, or es):

"${text}"

Language code:`
    }]
  });

  const detectedLanguage = response.content[0].type === 'text'
    ? response.content[0].text.trim().toLowerCase()
    : 'en';

  // Validar que é um dos idiomas suportados
  const supportedLanguages = ['pt', 'en', 'ro', 'ar', 'es'];
  return supportedLanguages.includes(detectedLanguage) ? detectedLanguage : 'en';
}
