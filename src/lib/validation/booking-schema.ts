import { z } from 'zod';

/** Remove tags HTML e caracteres perigosos (XSS básico). */
export function sanitizeString(value: string): string {
  return value
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[<>]/g, '')    // strip remaining angle brackets
    .trim();
}

export const bookingSchema = z.object({
  professional_id: z.string().uuid('ID do profissional inválido'),
  service_id: z.string().uuid('ID do serviço inválido'),

  // YYYY-MM-DD
  booking_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida — esperado YYYY-MM-DD'),

  // HH:MM (segundos opcionais)
  start_time: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Hora inválida — esperado HH:MM'),

  client_name: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(100, 'Nome muito longo'),

  // Aceita vazio, undefined ou email válido
  client_email: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().email('Email inválido').optional()
  ),

  // Aceita dígitos, espaços, traços, parênteses e prefixo +
  client_phone: z
    .string()
    .min(7, 'Telefone inválido')
    .max(25, 'Telefone inválido'),

  notes: z.string().max(500, 'Observações muito longas').optional(),

  service_location: z
    .enum(['in_salon', 'at_home', 'both'])
    .optional(),

  customer_address: z.string().max(200).optional(),
  customer_address_city: z.string().max(100).optional(),

  // ID do PaymentIntent Stripe — presente quando profissional exige sinal
  payment_intent_id: z.string().optional(),
});

export type BookingInput = z.infer<typeof bookingSchema>;
