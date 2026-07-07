'use client'

import { ReactNode } from 'react'
import { UserButton } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter()

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with User Button */}
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex justify-end">
          <UserButton
            afterSignOutUrl="/auth/signin"
            appearance={{
              elements: {
                avatarBox: 'w-10 h-10 rounded-lg',
              },
            }}
          />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
