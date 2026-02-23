import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TestimonialsManager } from './testimonials-manager';

export const metadata = {
  title: 'Depoimentos | CircleHood Booking',
  description: 'Gerencie depoimentos de clientes',
};

export default async function TestimonialsPage() {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get professional data
  const { data: professional } = await supabase
    .from('professionals')
    .select('id, business_name')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    redirect('/onboarding');
  }

  // Fetch existing testimonials
  const { data: testimonials } = await supabase
    .from('testimonials')
    .select('*')
    .eq('professional_id', professional.id)
    .order('order_index', { ascending: true });

  return (
    <div className="container mx-auto py-6 px-4 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Depoimentos</h1>
        <p className="text-muted-foreground mt-2">
          Adicione avaliações de clientes para mostrar na sua página
        </p>
      </div>

      <TestimonialsManager
        professionalId={professional.id}
        initialTestimonials={testimonials || []}
      />
    </div>
  );
}
