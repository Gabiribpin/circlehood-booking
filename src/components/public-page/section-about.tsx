import { AboutData } from '@/lib/page-sections/types';
import { Award, Star } from 'lucide-react';

interface SectionAboutProps {
  data: AboutData;
  theme?: string;
}

export function SectionAbout({ data, theme = 'default' }: SectionAboutProps) {
  return (
    <section className="py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold mb-6 text-center">{data.heading}</h2>

        {data.imageUrl && (
          <div className="mb-8 flex justify-center">
            <img
              src={data.imageUrl}
              alt={data.heading}
              className="rounded-lg shadow-lg max-w-md w-full object-cover h-64"
            />
          </div>
        )}

        <div className="prose prose-lg max-w-none mb-8">
          <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{data.description}</p>
        </div>

        {data.yearsExperience && data.yearsExperience > 0 && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <Star className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-3xl font-bold text-purple-900">{data.yearsExperience}+</p>
                <p className="text-purple-700">Anos de Experiência</p>
              </div>
            </div>
          </div>
        )}

        {data.specialties && data.specialties.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xl font-semibold mb-3">Especialidades</h3>
            <div className="flex flex-wrap gap-2">
              {data.specialties.map((specialty, index) => (
                <span
                  key={index}
                  className="bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium"
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.certifications && data.certifications.length > 0 && (
          <div>
            <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Certificações
            </h3>
            <div className="space-y-3">
              {data.certifications.map((cert, index) => (
                <div
                  key={index}
                  className="border-l-4 border-purple-500 pl-4 py-2"
                >
                  <p className="font-semibold">{cert.name}</p>
                  <p className="text-sm text-gray-600">
                    {cert.institution} • {cert.year}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
