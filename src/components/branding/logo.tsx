import Image from 'next/image';

interface LogoProps {
  /** 'default' usa o logo transparente (adaptável a qualquer fundo) */
  variant?: 'default';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Mostrar texto "CircleHood Booking" ao lado do logo */
  showText?: boolean;
  /** Texto extra abaixo do nome (ex: "by CircleHood Tech") */
  subtitle?: string;
}

const SIZES = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 72,
};

export function CircleHoodLogo({
  size = 'md',
  showText = false,
  subtitle,
}: LogoProps) {
  const px = SIZES[size];

  return (
    <div className="flex items-center gap-2">
      <Image
        src="/branding/circlehood-tech-logo.png"
        alt="CircleHood Tech"
        width={px}
        height={px}
        priority
        className="object-contain"
      />
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-sm">CircleHood Booking</span>
          {subtitle && (
            <span className="text-[10px] text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** Logo compacto para sidebar e headers */
export function CircleHoodLogoCompact({ size = 'sm' }: { size?: LogoProps['size'] }) {
  return <CircleHoodLogo size={size} showText={false} />;
}

/** Logo com nome + subtítulo para páginas de auth */
export function CircleHoodLogoFull() {
  return (
    <CircleHoodLogo
      size="lg"
      showText={true}
      subtitle="by CircleHood Tech"
    />
  );
}
