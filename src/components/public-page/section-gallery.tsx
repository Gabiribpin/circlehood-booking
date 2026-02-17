'use client';

import { useState, useEffect } from 'react';
import { GalleryData } from '@/lib/page-sections/types';
import { BeforeAfterSlider } from './before-after-slider';

interface SectionGalleryProps {
  data: GalleryData;
  professionalId: string;
  theme?: string;
}

export function SectionGallery({ data, professionalId, theme = 'default' }: SectionGalleryProps) {
  const [images, setImages] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchImages();
  }, [professionalId, selectedCategory]);

  const fetchImages = async () => {
    try {
      const params = new URLSearchParams({
        professionalId,
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
      });

      const res = await fetch(`/api/gallery?${params}`);
      const data = await res.json();
      setImages(data.images || []);
    } catch (error) {
      console.error('Error fetching gallery:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-gray-500">Carregando galeria...</p>
        </div>
      </section>
    );
  }

  if (images.length === 0) {
    return null; // Não mostrar seção se não houver imagens
  }

  const gridColsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  }[data.columns];

  return (
    <section className="py-12 px-4 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold mb-2 text-center">{data.heading}</h2>
        {data.description && (
          <p className="text-gray-600 text-center mb-8">{data.description}</p>
        )}

        {data.showCategories && data.categories && data.categories.length > 0 && (
          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Todos
            </button>
            {data.categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedCategory === category
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        )}

        <div className={`grid ${gridColsClass} gap-4`}>
          {images.map((image) => (
            <div key={image.id}>
              {image.is_before_after && image.before_image_url && image.after_image_url ? (
                <BeforeAfterSlider
                  beforeImage={image.before_image_url}
                  afterImage={image.after_image_url}
                  title={image.title}
                />
              ) : (
                <div className="relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow group">
                  <img
                    src={image.image_url}
                    alt={image.title || ''}
                    className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {(image.title || image.description) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                      <div className="text-white">
                        {image.title && <p className="font-semibold">{image.title}</p>}
                        {image.description && <p className="text-sm">{image.description}</p>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
