'use client';

import { useState, useEffect } from 'react';
import { TestimonialsData } from '@/lib/page-sections/types';
import { Star } from 'lucide-react';

interface SectionTestimonialsProps {
  data: TestimonialsData;
  professionalId: string;
  theme?: string;
}

export function SectionTestimonials({ data, professionalId, theme = 'default' }: SectionTestimonialsProps) {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTestimonials();
  }, [professionalId]);

  const fetchTestimonials = async () => {
    try {
      const res = await fetch(`/api/testimonials?professionalId=${professionalId}`);
      const result = await res.json();
      setTestimonials((result.testimonials || []).slice(0, data.maxToShow));
    } catch (error) {
      console.error('Error fetching testimonials:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500">Carregando depoimentos...</p>
        </div>
      </section>
    );
  }

  if (testimonials.length === 0) {
    return null; // Não mostrar seção se não houver depoimentos
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-2 text-center">{data.heading}</h2>
        {data.description && (
          <p className="text-gray-600 text-center mb-8">{data.description}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              {data.showPhotos && testimonial.client_photo_url && (
                <img
                  src={testimonial.client_photo_url}
                  alt={testimonial.client_name}
                  className="w-16 h-16 rounded-full object-cover mb-4"
                />
              )}

              <div className="mb-3">
                <p className="font-semibold text-lg">{testimonial.client_name}</p>
                {testimonial.service_name && (
                  <p className="text-sm text-gray-500">{testimonial.service_name}</p>
                )}
              </div>

              {data.showRatings && (
                <div className="mb-3">{renderStars(testimonial.rating)}</div>
              )}

              <p className="text-gray-700 italic">"{testimonial.testimonial_text}"</p>

              {testimonial.testimonial_date && (
                <p className="text-xs text-gray-400 mt-3">
                  {new Date(testimonial.testimonial_date).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
