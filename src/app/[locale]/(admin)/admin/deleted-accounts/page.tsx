import { createAdminClient } from '@/lib/supabase/admin';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { RestoreAccountButton } from '@/components/admin/restore-account-button';

interface DeletedProfessional {
  id: string;
  business_name: string;
  user_id: string;
  phone: string | null;
  whatsapp: string | null;
  subscription_status: string;
  stripe_customer_id: string | null;
  deleted_at: string;
  deletion_scheduled_for: string;
  is_active: boolean;
}

function daysRemaining(deletionDate: string): number {
  return Math.ceil((new Date(deletionDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default async function DeletedAccountsPage() {
  const supabase = createAdminClient();

  const { data: professionals } = await supabase
    .from('professionals')
    .select('id, business_name, user_id, phone, whatsapp, subscription_status, stripe_customer_id, deleted_at, deletion_scheduled_for, is_active')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  const list = (professionals ?? []) as DeletedProfessional[];

  // Fetch emails from auth.users for each professional
  const emailMap: Record<string, string> = {};
  for (const p of list) {
    try {
      const { data } = await supabase.auth.admin.getUserById(p.user_id);
      if (data?.user?.email) emailMap[p.user_id] = data.user.email;
    } catch {
      // ignore
    }
  }

  const now = new Date();

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Trash2 className="h-5 w-5 text-destructive" />
        <div>
          <h1 className="text-xl font-bold">Contas Excluídas</h1>
          <p className="text-sm text-slate-500">
            {list.length} conta{list.length !== 1 ? 's' : ''} marcada{list.length !== 1 ? 's' : ''} para exclusão
          </p>
        </div>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-slate-400">
            Nenhuma conta marcada para exclusão.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => {
            const scheduledDate = new Date(p.deletion_scheduled_for);
            const isPermanentlyDeleted = scheduledDate <= now;
            const days = daysRemaining(p.deletion_scheduled_for);

            return (
              <Card key={p.id} className={isPermanentlyDeleted ? 'border-slate-300 opacity-60' : 'border-red-200'}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="text-base">{p.business_name}</CardTitle>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {emailMap[p.user_id] ?? '—'}
                        {(p.phone || p.whatsapp) && (
                          <> · {p.phone ?? p.whatsapp}</>
                        )}
                      </p>
                    </div>
                    {isPermanentlyDeleted ? (
                      <Badge variant="destructive">Excluída definitivamente</Badge>
                    ) : (
                      <Badge variant="outline" className="border-orange-400 text-orange-600">
                        Aguardando ({days}d restante{days !== 1 ? 's' : ''})
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-500 mb-3">
                    <div>
                      <span className="font-medium text-slate-700">Solicitou exclusão: </span>
                      {new Date(p.deleted_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Exclusão definitiva em: </span>
                      {scheduledDate.toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                    <div>
                      <span className="font-medium text-slate-700">Plano: </span>
                      {p.subscription_status}
                    </div>
                    {p.stripe_customer_id && (
                      <div>
                        <span className="font-medium text-slate-700">Stripe: </span>
                        <code className="text-[10px]">{p.stripe_customer_id}</code>
                      </div>
                    )}
                  </div>

                  {!isPermanentlyDeleted && (
                    <RestoreAccountButton professionalId={p.id} />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
