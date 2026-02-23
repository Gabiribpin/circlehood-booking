import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Página não encontrada</h1>
        <p className="text-muted-foreground mb-6">
          Este profissional não existe ou a página foi desativada.
        </p>
        <Button asChild>
          <Link href="/">Voltar ao inicio</Link>
        </Button>
      </div>
    </div>
  );
}
