import { useUser, useAuth as useClerkAuth } from '@clerk/nextjs'
import { useCallback } from 'react'

/**
 * Custom hook for authentication with Clerk
 */
export function useAuth() {
  const { user, isLoaded } = useUser()
  const { signOut, getToken } = useClerkAuth()

  const userRole = (user?.publicMetadata?.role as string) || 'investigator'
  const userBadge = user?.publicMetadata?.badge
  const userDepartment = user?.publicMetadata?.department

  const handleSignOut = useCallback(async () => {
    await signOut()
  }, [signOut])

  const getAuthToken = useCallback(async () => {
    return await getToken()
  }, [getToken])

  return {
    user,
    isLoaded,
    userRole,
    userBadge,
    userDepartment,
    handleSignOut,
    getAuthToken,
    isAuthenticated: !!user,
  }
}

/**
 * Check if user has specific role
 */
export function useRequireRole(requiredRole: string) {
  const { userRole, isAuthenticated } = useAuth()

  const roleHierarchy: Record<string, number> = {
    admin: 3,
    investigator: 2,
    analyst: 1,
    viewer: 0,
  }

  const hasRole = roleHierarchy[userRole] >= roleHierarchy[requiredRole]

  return {
    hasRole,
    isAuthenticated,
    currentRole: userRole,
  }
}
