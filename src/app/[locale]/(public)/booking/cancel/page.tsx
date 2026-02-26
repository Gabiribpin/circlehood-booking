import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function BookingCancelPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <XCircle className="h-16 w-16 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold">Pagamento cancelado</h1>
          <p className="text-muted-foreground">
            O pagamento foi cancelado. O seu agendamento não foi confirmado.
          </p>
          <p className="text-sm text-muted-foreground">
            Pode tentar novamente quando quiser.
          </p>
          <Button asChild className="w-full">
            <Link href="/">Tentar novamente</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
