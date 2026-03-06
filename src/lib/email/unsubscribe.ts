const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ?? 'https://booking.circlehood-tech.com';

export function getUnsubscribeUrl(token: string): string {
  return `${BASE_URL}/api/email/unsubscribe?token=${token}`;
}

export function getUnsubscribeHeaders(token: string): Record<string, string> {
  const url = getUnsubscribeUrl(token);
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export function getMarketingEmailFooter(token: string): string {
  const url = getUnsubscribeUrl(token);
  return `
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="font-size: 0.8em; color: #888; text-align: center;">
      CircleHood Tech — Dublin, Ireland<br/>
      <a href="mailto:privacy@circlehood-tech.com">privacy@circlehood-tech.com</a>
    </p>
    <p style="font-size: 0.75em; color: #aaa; text-align: center;">
      <a href="${url}" style="color: #aaa;">Cancelar inscrição</a> · Você recebeu este email porque tem uma conta no CircleHood Booking.
    </p>
  `;
}

export function getTransactionalEmailFooter(): string {
  return `
    <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
    <p style="font-size: 0.8em; color: #888; text-align: center;">
      CircleHood Tech — Dublin, Ireland<br/>
      <a href="mailto:privacy@circlehood-tech.com">privacy@circlehood-tech.com</a>
    </p>
  `;
}
