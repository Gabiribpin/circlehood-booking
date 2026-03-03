'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { TestimonialsData } from '@/lib/page-sections/types';
import { Star, MessageSquarePlus, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SectionTestimonialsProps {
  data: TestimonialsData;
  professionalId: string;
  theme?: string;
}

export function SectionTestimonials({ data, professionalId, theme = 'default' }: SectionTestimonialsProps) {
  const t = useTranslations('testimonials');
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);

  useEffect(() => {
    fetchTestimonials();
  }, [professionalId]);

  const fetchTestimonials = async () => {
    try {
      const res = await fetch(`/api/testimonials?professionalId=${professionalId}`);
      const result = await res.json();
      setTestimonials((result.testimonials || []).slice(0, data.maxToShow));
    } catch (error) {
      logger.error('Error fetching testimonials:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePublicSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          professional_id: professionalId,
          client_name: formData.get('client_name'),
          testimonial_text: formData.get('testimonial_text'),
          rating: selectedRating,
          service_name: formData.get('service_name') || null,
        }),
      });

      if (!res.ok) throw new Error('Submit failed');

      setSubmitted(true);
      setShowForm(false);
      setSelectedRating(5);
    } catch (error) {
      logger.error('Error submitting testimonial:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500">{t('loadingPublic')}</p>
        </div>
      </section>
    );
  }

  const renderStars = (rating: number, interactive = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && setSelectedRating(star)}
            disabled={!interactive}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <section className="py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {testimonials.length > 0 && (
          <>
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

                  <p className="text-gray-700 italic">&quot;{testimonial.testimonial_text}&quot;</p>

                  {testimonial.testimonial_date && (
                    <p className="text-xs text-gray-400 mt-3">
                      {new Date(testimonial.testimonial_date).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Botão para deixar depoimento */}
        {!submitted && !showForm && (
          <div className="text-center mt-8">
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
            >
              <MessageSquarePlus className="w-5 h-5" />
              {t('leaveTestimonial')}
            </button>
          </div>
        )}

        {/* Mensagem de sucesso */}
        {submitted && (
          <div className="text-center mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700 font-medium">
              {t('thankYou')}
            </p>
          </div>
        )}

        {/* Formulário público */}
        {showForm && (
          <div className="mt-8 max-w-lg mx-auto bg-white rounded-lg shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">{t('leaveTestimonial')}</h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-500 text-sm mb-6">
              {t('formDesc')}
            </p>

            <form onSubmit={handlePublicSubmit} className="space-y-4">
              <div>
                <label htmlFor="public_client_name" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('yourNameLabel')}
                </label>
                <input
                  id="public_client_name"
                  name="client_name"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder={t('clientNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('ratingPublicLabel')}
                </label>
                {renderStars(selectedRating, true)}
              </div>

              <div>
                <label htmlFor="public_testimonial_text" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('yourTestimonialLabel')}
                </label>
                <textarea
                  id="public_testimonial_text"
                  name="testimonial_text"
                  required
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
                  placeholder={t('testimonialPublicPlaceholder')}
                />
              </div>

              <div>
                <label htmlFor="public_service_name" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('serviceOptionalLabel')}
                </label>
                <input
                  id="public_service_name"
                  name="service_name"
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                  placeholder={t('servicePlaceholder')}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? t('sending') : t('sendTestimonial')}
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}
