'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SettingsManager } from '@/components/dashboard/settings-manager';
import { SubscriptionSection } from '@/components/dashboard/settings-manager';
import { WhatsAppConfigClient, AiAssistantSection } from '@/app/[locale]/(dashboard)/whatsapp-config/whatsapp-config-client';
import { EmailNotificationsManager } from '@/components/dashboard/email-notifications-manager';
import { SimplifiedPaymentSetup } from '@/components/settings/SimplifiedPaymentSetup';
import { PaymentSettings } from '@/components/dashboard/payment-settings';
import type { PlanPrice } from '@/lib/pricing';
import type { Professional } from '@/types/database';

const VALID_TABS = ['conta', 'assinatura', 'pagamentos', 'whatsapp', 'assistente', 'notificacoes'] as const;
type TabValue = (typeof VALID_TABS)[number];

interface UnifiedSettingsProps {
  // Account tab
  professional: Pick<Professional, 'business_name' | 'slug' | 'subscription_status' | 'trial_ends_at' | 'stripe_customer_id'> & {
    id: string;
    locale?: string | null;
    account_number?: string | null;
    created_at: string;
    currency?: string | null;
    payment_method?: string | null;
    manual_payment_key?: string | null;
    payment_country?: string | null;
    require_deposit?: boolean | null;
    deposit_type?: string | null;
    deposit_value?: number | null;
  };
  trialDaysLeft: number;
  trialExpired: boolean;
  success: boolean;
  cancelled: boolean;
  planPrice: PlanPrice;
  host: string;
  // WhatsApp tab
  whatsappInitialConfig: {
    phone: string;
    instanceName: string;
    isActive: boolean;
  };
  // AI Assistant tab
  aiInitialConfig: {
    instructions: string;
    greetingMessage: string;
    businessName: string;
  };
  // Payments tab
  stripeConnected: boolean;
  // Notifications tab
  notificationLogs: Array<{
    id: string;
    channel: string;
    type: string;
    recipient: string;
    message: string;
    status: string;
    error_message: string | null;
    booking_id: string | null;
    created_at: string;
  }>;
}

export function UnifiedSettings({
  professional,
  trialDaysLeft,
  trialExpired,
  success,
  cancelled,
  planPrice,
  host,
  whatsappInitialConfig,
  aiInitialConfig,
  stripeConnected,
  notificationLogs,
}: UnifiedSettingsProps) {
  const t = useTranslations('settings');
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tabParam = searchParams.get('tab') as TabValue | null;
  const activeTab: TabValue = tabParam && VALID_TABS.includes(tabParam) ? tabParam : 'conta';

  function handleTabChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList variant="line" className="w-full overflow-x-auto">
          <TabsTrigger value="conta">{t('tabAccount')}</TabsTrigger>
          <TabsTrigger value="assinatura">{t('tabSubscription')}</TabsTrigger>
          <TabsTrigger value="pagamentos">{t('tabPayments')}</TabsTrigger>
          <TabsTrigger value="whatsapp">{t('tabWhatsapp')}</TabsTrigger>
          <TabsTrigger value="assistente">{t('tabAssistant')}</TabsTrigger>
          <TabsTrigger value="notificacoes">{t('tabNotifications')}</TabsTrigger>
        </TabsList>

        <TabsContent value="conta">
          <SettingsManager
            professional={professional}
            host={host}
          />
        </TabsContent>

        <TabsContent value="assinatura">
          <SubscriptionSection
            professional={professional}
            trialDaysLeft={trialDaysLeft}
            trialExpired={trialExpired}
            success={success}
            cancelled={cancelled}
            planPrice={planPrice}
          />
        </TabsContent>

        <TabsContent value="pagamentos">
          <div className="space-y-6 pt-2">
            <SimplifiedPaymentSetup
              currentMethod={professional.payment_method ?? null}
              currentKey={professional.manual_payment_key ?? null}
              currentCountry={professional.payment_country ?? null}
            />
            <PaymentSettings
              requireDeposit={professional.require_deposit ?? false}
              depositType={(professional.deposit_type as 'percentage' | 'fixed' | null) ?? null}
              depositValue={professional.deposit_value ?? null}
              currency={professional.currency ?? 'EUR'}
              stripeConnected={stripeConnected}
            />
          </div>
        </TabsContent>

        <TabsContent value="whatsapp">
          <WhatsAppConfigClient initialConfig={whatsappInitialConfig} />
        </TabsContent>

        <TabsContent value="assistente">
          <AiAssistantSection initialConfig={aiInitialConfig} />
        </TabsContent>

        <TabsContent value="notificacoes">
          <EmailNotificationsManager
            logs={notificationLogs}
            professionalId={professional.id}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
