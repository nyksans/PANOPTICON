import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Providers } from './providers'
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
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className="bg-slate-950 text-slate-50">
          <Providers>
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
