import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Providers } from './providers'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'PANOPTICON - Forensic Investigation Platform',
  description: 'Advanced AI-powered forensic investigation and evidence analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="en" suppressHydrationWarning>
        <body>
          <Script id="theme-init" strategy="beforeInteractive">{`
            (function() {
              var saved = localStorage.getItem('panopticon-theme') || 'dark';
              document.documentElement.setAttribute('data-theme', saved);
            })();
          `}</Script>
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
