'use client';

/**
 * Global error boundary — catches errors in the root layout.
 * Must be fully self-contained (no external imports) since the
 * root layout, providers, fonts, and i18n may all be broken.
 *
 * Next.js requires global-error to include its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 420, padding: 24 }}>
          <div
            style={{
              fontSize: 48,
              marginBottom: 16,
            }}
            aria-hidden="true"
          >
            ⚠️
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: '#111827',
              marginBottom: 8,
            }}
          >
            Algo deu errado
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#6b7280',
              marginBottom: 24,
              lineHeight: 1.5,
            }}
          >
            Ocorreu um erro inesperado. Tente recarregar a página.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: '#9ca3af',
                marginBottom: 24,
                fontFamily: 'monospace',
              }}
            >
              Código: {error.digest}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            <button
              onClick={reset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Tentar novamente
            </button>
            <a
              href="/"
              style={{
                padding: '10px 20px',
                backgroundColor: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                cursor: 'pointer',
              }}
            >
              Página inicial
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
