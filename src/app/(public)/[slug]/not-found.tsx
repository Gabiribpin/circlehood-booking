import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">Pagina nao encontrada</h1>
        <p className="text-muted-foreground mb-6">
          Este profissional nao existe ou a pagina foi desativada.
        </p>
        <Button asChild>
          <Link href="/">Voltar ao inicio</Link>
        </Button>
      </div>
    </div>
  );
}
