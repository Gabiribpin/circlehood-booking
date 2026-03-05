import Link from 'next/link';

export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center px-4 bg-background text-foreground">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-2">404</h1>
          <p className="text-xl text-muted-foreground mb-6">
            Page not found
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to home
          </Link>
        </div>
      </body>
    </html>
  );
}
