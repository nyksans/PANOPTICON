import { clerkClient, auth } from '@clerk/nextjs/server'

/**
 * Get current authenticated user from Clerk
 */
export async function getCurrentClerkUser() {
  try {
    const { userId } = auth()
    if (!userId) return null
    
    const user = await clerkClient.users.getUser(userId)
    return user
  } catch (error) {
    console.error('Error fetching Clerk user:', error)
    return null
  }
}

/**
 * Format Clerk user for application use
 */
export function formatClerkUser(clerkUser: any) {
  return {
    id: clerkUser.id,
    email: clerkUser.emailAddresses?.[0]?.emailAddress,
    name: clerkUser.firstName && clerkUser.lastName 
      ? `${clerkUser.firstName} ${clerkUser.lastName}`
      : clerkUser.firstName || clerkUser.username,
    image: clerkUser.profileImageUrl,
    role: clerkUser.publicMetadata?.role || 'investigator',
    badge: clerkUser.publicMetadata?.badge,
    department: clerkUser.publicMetadata?.department,
  }
}

/**
 * Verify Clerk session
 */
export async function verifyClerkSession() {
  const { userId } = auth()
  return !!userId
}
