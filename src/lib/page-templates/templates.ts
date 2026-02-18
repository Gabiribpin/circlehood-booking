export interface SectionTemplate {
  name: string;
  icon: string;
  description: string;
  section_type: string;
  theme: string;
  is_visible: boolean;
  data: Record<string, unknown>;
}

export const SECTION_TEMPLATES: Record<string, SectionTemplate> = {
  pricing_table: {
    name: 'Tabela de Preços',
    icon: '💰',
    description: '3 planos com features e botão de CTA',
    section_type: 'services',
    theme: 'modern',
    is_visible: true,
    data: {
      heading: 'Nossos Serviços',
      description: 'Escolha o serviço ideal para você',
      layout: 'pricing',
      plans: [
        {
          id: 'basic',
          tier: 'Básico',
          price: '€25',
          duration: '30min',
          highlight: false,
          features: [
            'Atendimento completo',
            'Produtos de qualidade',
            'Agendamento online',
          ],
          ctaText: 'Agendar',
        },
        {
          id: 'popular',
          tier: 'Popular',
          price: '€40',
          duration: '45min',
          highlight: true,
          badge: '⭐ Mais escolhido',
          features: [
            'Tudo do Básico',
            'Tratamento especial',
            'Produto premium incluído',
            'Lembrete automático',
          ],
          ctaText: 'Agendar',
        },
        {
          id: 'premium',
          tier: 'Premium',
          price: '€60',
          duration: '60min',
          highlight: false,
          features: [
            'Tudo do Popular',
            'Atendimento VIP',
            'Kit de presente',
            'Desconto fidelidade',
            'Prioridade na agenda',
          ],
          ctaText: 'Agendar',
        },
      ],
    },
  },

  gallery_grid: {
    name: 'Galeria 3 Colunas',
    icon: '🖼️',
    description: 'Grade de fotos responsiva com legendas',
    section_type: 'gallery',
    theme: 'default',
    is_visible: true,
    data: {
      heading: 'Nosso Trabalho',
      description: 'Veja alguns dos nossos resultados',
      layout: 'grid',
      columns: 3,
      showCaptions: true,
      items: [
        { id: '1', caption: 'Trabalho 1', before: '', after: '' },
        { id: '2', caption: 'Trabalho 2', before: '', after: '' },
        { id: '3', caption: 'Trabalho 3', before: '', after: '' },
      ],
    },
  },

  testimonials_carousel: {
    name: 'Depoimentos Carrossel',
    icon: '⭐',
    description: 'Reviews de clientes com avatar e avaliação',
    section_type: 'testimonials',
    theme: 'elegant',
    is_visible: true,
    data: {
      heading: 'O que dizem nossos clientes',
      description: 'Avaliações reais de quem já nos visitou',
      style: 'carousel',
      reviews: [
        {
          id: '1',
          name: 'Sarah O.',
          avatar: '',
          rating: 5,
          text: 'Adorei o atendimento! Profissional incrível, resultado perfeito. Já marquei para o próximo mês! 💅',
          date: '',
        },
        {
          id: '2',
          name: 'Maria S.',
          avatar: '',
          rating: 5,
          text: 'Melhor profissional que já conheci. Pontual, cuidadosa e o resultado dura semanas.',
          date: '',
        },
        {
          id: '3',
          name: 'Ana C.',
          avatar: '',
          rating: 5,
          text: 'Super recomendo! Ambiente aconchegante e preço justo. Voltarei com certeza.',
          date: '',
        },
      ],
    },
  },
};

// Array ordenado para exibir na UI
export const TEMPLATES_LIST = Object.entries(SECTION_TEMPLATES).map(
  ([key, template]) => ({ key, ...template })
);
