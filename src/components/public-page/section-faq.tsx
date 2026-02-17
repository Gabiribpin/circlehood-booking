'use client';

import { useState } from 'react';
import { FAQData } from '@/lib/page-sections/types';
import { ChevronDown } from 'lucide-react';

interface SectionFAQProps {
  data: FAQData;
  theme?: string;
}

export function SectionFAQ({ data, theme = 'default' }: SectionFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!data.items || data.items.length === 0) {
    return null;
  }

  return (
    <section className="py-12 px-4 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold mb-8 text-center">{data.heading}</h2>

        <div className="space-y-4">
          {data.items.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-lg shadow-sm overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="font-semibold text-lg pr-4">{item.question}</span>
                <ChevronDown
                  className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${
                    openIndex === index ? 'transform rotate-180' : ''
                  }`}
                />
              </button>

              {openIndex === index && (
                <div className="px-5 pb-5 pt-2">
                  <p className="text-gray-700 leading-relaxed">{item.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
