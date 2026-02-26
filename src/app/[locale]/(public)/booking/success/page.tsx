import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

export default function BookingSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h1 data-testid="success-message" className="text-2xl font-bold">Agendamento confirmado!</h1>
          <p data-testid="payment-confirmed" className="text-muted-foreground">
            O seu pagamento foi processado com sucesso e o agendamento foi confirmado.
          </p>
          <p className="text-sm text-muted-foreground">
            Receberá uma confirmação em breve por email e/ou WhatsApp.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">Voltar ao início</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
