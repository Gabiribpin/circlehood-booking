export interface PageSection {
  id: string;
  professional_id: string;
  section_type: SectionType;
  order_index: number;
  data: SectionData;
  is_visible: boolean;
  theme: ThemeType;
  created_at: string;
  updated_at: string;
}

export type SectionType = 'hero' | 'about' | 'services' | 'gallery' | 'testimonials' | 'faq' | 'contact';

export type ThemeType = 'default' | 'modern' | 'elegant' | 'minimalist';

export type SectionData =
  | HeroData
  | AboutData
  | ServicesData
  | GalleryData
  | TestimonialsData
  | FAQData
  | ContactData;

export interface HeroData {
  title?: string;
  subtitle?: string;
  ctaText: string;
  backgroundUrl?: string;
  avatarUrl?: string;
  showSocialLinks: boolean;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
}

export interface AboutData {
  heading: string;
  description: string;
  yearsExperience?: number;
  certifications?: Array<{
    name: string;
    institution: string;
    year: number;
  }>;
  specialties?: string[];
  imageUrl?: string;
}

export interface ServicesData {
  heading: string;
  description?: string;
  displayMode: 'grid' | 'list';
  showPrices: boolean;
  showDuration: boolean;
  showDescription: boolean;
  ctaText: string;
}

export interface GalleryData {
  heading: string;
  description?: string;
  layout: 'grid' | 'masonry' | 'carousel';
  columns: 2 | 3 | 4;
  showCategories: boolean;
  categories?: string[];
}

export interface TestimonialsData {
  heading: string;
  description?: string;
  displayMode: 'grid' | 'carousel';
  showRatings: boolean;
  showPhotos: boolean;
  maxToShow: number;
}

export interface FAQData {
  heading: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
}

export interface ContactData {
  heading: string;
  showPhone: boolean;
  showEmail: boolean;
  showWhatsApp: boolean;
  showAddress: boolean;
  showMap: boolean;
  mapEmbedUrl?: string;
}

export const THEME_COLORS: Record<ThemeType, Record<string, string>> = {
  default: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#f093fb',
    background: '#ffffff',
    text: '#333333',
  },
  modern: {
    primary: '#000000',
    secondary: '#ff6b6b',
    accent: '#ffd93d',
    background: '#f8f9fa',
    text: '#1a1a1a',
  },
  elegant: {
    primary: '#c89d66',
    secondary: '#8b7355',
    accent: '#f4e4d7',
    background: '#fefefe',
    text: '#2c2c2c',
  },
  minimalist: {
    primary: '#4a5568',
    secondary: '#718096',
    accent: '#cbd5e0',
    background: '#ffffff',
    text: '#2d3748',
  },
};
