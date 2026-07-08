'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface AuthContextType {
  isSignedIn: boolean
  user: { id: string; email: string } | null
  signOut: () => void
  signIn: (email: string, password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [user, setUser] = useState<{ id: string; email: string } | null>(null)

  useEffect(() => {
    // Check localStorage for existing session
    const storedUser = localStorage.getItem('panopticon_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
      setIsSignedIn(true)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    // Simple local auth for development
    if (email && password) {
      const userData = { id: '1', email }
      setUser(userData)
      setIsSignedIn(true)
      localStorage.setItem('panopticon_user', JSON.stringify(userData))
    }
  }

  const signOut = () => {
    setUser(null)
    setIsSignedIn(false)
    localStorage.removeItem('panopticon_user')
  }

  return (
    <AuthContext.Provider value={{ isSignedIn, user, signOut, signIn }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
