'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Star, Trash2, MessageSquare, CheckCircle } from 'lucide-react';

interface Testimonial {
  id: string;
  client_name: string;
  client_photo_url?: string;
  testimonial_text: string;
  rating: number;
  service_name?: string;
  testimonial_date: string;
  is_visible: boolean;
  is_featured: boolean;
}

interface TestimonialsManagerProps {
  professionalId: string;
  initialTestimonials: Testimonial[];
}

export function TestimonialsManager({ professionalId, initialTestimonials }: TestimonialsManagerProps) {
  const t = useTranslations('testimonials');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [testimonials, setTestimonials] = useState<Testimonial[]>(initialTestimonials);
  const { toast } = useToast();

  const approvedTestimonials = testimonials.filter((t) => t.is_visible);
  const pendingTestimonials = testimonials.filter((t) => !t.is_visible);

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/testimonials?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setTestimonials((prev) => prev.filter((t) => t.id !== id));

      toast({
        title: tc('success'),
        description: t('removed'),
      });
    } catch (error) {
      toast({
        title: tc('error'),
        description: t('deleteError'),
        variant: 'destructive',
      });
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const response = await fetch('/api/testimonials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_visible: true }),
      });

      if (!response.ok) throw new Error('Approve failed');

      const { testimonial } = await response.json();
      setTestimonials((prev) =>
        prev.map((t) => (t.id === testimonial.id ? testimonial : t))
      );

      toast({
        title: tc('success'),
        description: t('approved'),
      });
    } catch (error) {
      toast({
        title: tc('error'),
        description: t('saveError'),
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm(t('confirmReject'))) return;
    await handleDelete(id);
  };

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

  const renderTestimonialCard = (testimonial: Testimonial, isPending: boolean) => (
    <Card key={testimonial.id}>
      <CardContent className="p-6">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-lg">{testimonial.client_name}</p>
                {isPending && (
                  <Badge variant="secondary">{t('pendingBadge')}</Badge>
                )}
              </div>
              {testimonial.service_name && (
                <p className="text-sm text-muted-foreground">{testimonial.service_name}</p>
              )}
            </div>
            {renderStars(testimonial.rating)}
          </div>

          <p className="text-gray-700 italic">&quot;{testimonial.testimonial_text}&quot;</p>

          <p className="text-xs text-muted-foreground">
            {new Date(testimonial.testimonial_date).toLocaleDateString(locale)}
          </p>

          <div className="flex gap-2 pt-3 border-t">
            {isPending ? (
              <>
                <Button
                  size="sm"
                  onClick={() => handleApprove(testimonial.id)}
                  className="flex-1"
                >
                  <CheckCircle className="w-4 h-4 mr-1" />
                  {t('approve')}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleReject(testimonial.id)}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  {t('reject')}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(testimonial.id)}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                {t('reject')}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="approved">
        <TabsList>
          <TabsTrigger value="approved">
            {t('approvedTab')}
          </TabsTrigger>
          <TabsTrigger value="pending">
            {t('pendingTab')}
            {pendingTestimonials.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingTestimonials.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approved" className="mt-4">
          {approvedTestimonials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {approvedTestimonials.map((testimonial) =>
                renderTestimonialCard(testimonial, false)
              )}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t('noTestimonials')}</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          {pendingTestimonials.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingTestimonials.map((testimonial) =>
                renderTestimonialCard(testimonial, true)
              )}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t('noPending')}</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
