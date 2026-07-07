# Clerk Authentication Setup Guide

## Overview
This guide shows how to set up Clerk authentication for PANOPTICON. Clerk provides secure, modern authentication with email/password, social login, and multi-factor authentication (MFA).

## Prerequisites
- Clerk account at https://clerk.com
- Node.js 18+ installed
- Next.js 14 project setup

---

## 1. Create Clerk Application

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Click **Create Application**
3. Enter application name: `PANOPTICON`
4. Select authentication methods:
   - ✅ Email/Password
   - ✅ Google
   - ✅ Microsoft
   - ✅ GitHub (optional)
5. Click **Create application**

---

## 2. Get API Keys

In Clerk Dashboard:

1. Go to **API Keys** section
2. Copy your keys (never hardcode these):
   - **Publishable Key**: `pk_test_...` (safe for frontend)
   - **Secret Key**: `sk_test_...` (backend only)

Example keys (never use these in production):
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_Y2FyaW5nLWJhc3MtNjcuY2xlcmsuYWNjb3VudHMuZGV2JACLERK_SECRET_KEY=sk_test_vGOpLEZ6TypMQIzNsSzaVujbLtlo4abrZngRe8trTb
```

---

## 3. Configure Environment Variables

### Create `.env.local` in frontend directory:

```bash
# Copy from Clerk Dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key

# Other configs
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

⚠️ **Important**: Use `.env.local` (git-ignored) - never commit secrets!

---

## 4. Install Dependencies

```bash
cd frontend
npm install @clerk/nextjs
```

---

## 5. Setup Complete ✅

The following files are already configured:

### Frontend Files
- `src/app/layout.tsx` - ClerkProvider wrapper
- `src/app/(app)/layout.tsx` - Protected app layout
- `src/app/auth/signin/page.tsx` - Sign in page
- `src/app/auth/signup/page.tsx` - Sign up page
- `middleware.ts` - Route protection middleware
- `src/lib/clerk.ts` - Clerk utilities
- `src/hooks/useAuth.ts` - Auth hooks

---

## 6. Configure Clerk Dashboard

### Allowed Redirect URLs
1. Go to **Allowed Redirect URLs** in settings
2. Add these URLs:
   ```
   http://localhost:3000
   http://localhost:3000/dashboard
   http://localhost:3000/auth/signin
   http://localhost:3000/auth/signup
   ```
3. For production, add:
   ```
   https://your-domain.com
   https://your-domain.com/dashboard
   ```

### Sign Up URLs
```
http://localhost:3000/auth/signup
https://your-domain.com/auth/signup
```

### Sign In URLs
```
http://localhost:3000/auth/signin
https://your-domain.com/auth/signin
```

---

## 7. Configure User Metadata

In Clerk Dashboard → **User** tab, you can store custom metadata:

```json
{
  "role": "investigator",
  "badge": "DET-4821",
  "department": "Homicide Division"
}
```

This metadata is automatically loaded in the app via `useAuth()` hook.

---

## 8. Running the Application

### Start Development Server
```bash
npm run dev
```

### Test Routes
- Public: `http://localhost:3000`
- Sign In: `http://localhost:3000/auth/signin`
- Sign Up: `http://localhost:3000/auth/signup`
- Dashboard: `http://localhost:3000/dashboard` (requires auth)

---

## 9. Using Authentication

### In Components
```tsx
'use client'

import { useAuth } from '@clerk/nextjs'
import { useUser } from '@clerk/nextjs'

export function MyComponent() {
  const { userId, signOut } = useAuth()
  const { user, isLoaded } = useUser()

  if (!isLoaded) return <div>Loading...</div>

  return (
    <div>
      <p>Welcome, {user?.firstName}!</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  )
}
```

### Using Custom Auth Hook
```tsx
import { useAuth } from '@/hooks/useAuth'

export function MyComponent() {
  const { user, userRole, userBadge, handleSignOut } = useAuth()

  return (
    <div>
      <p>Role: {userRole}</p>
      <p>Badge: {userBadge}</p>
      <button onClick={handleSignOut}>Logout</button>
    </div>
  )
}
```

### Protecting Routes
```tsx
import { useRequireRole } from '@/hooks/useAuth'

export function AdminPanel() {
  const { hasRole, isAuthenticated } = useRequireRole('admin')

  if (!isAuthenticated || !hasRole) {
    return <div>Access Denied</div>
  }

  return <div>Admin Panel Content</div>
}
```

---

## 10. Social Login Configuration

### Enable Google Login
1. Clerk Dashboard → **Social Connections**
2. Click **Google**
3. Add Google OAuth credentials:
   - Get from [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URI
4. Copy Client ID and Secret to Clerk

### Enable Microsoft Login
1. Similar process via [Microsoft Azure Portal](https://portal.azure.com)
2. Create app registration
3. Get Client ID and secret
4. Configure redirect URI

---

## 11. Secure API Routes (Backend Integration)

### Verify Clerk Token in FastAPI
```python
from fastapi import Depends, HTTPException
import httpx

async def verify_clerk_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing token")
    
    token = authorization.replace("Bearer ", "")
    
    # Verify token with Clerk
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.clerk.com/v1/jwt_templates",
            headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"}
        )
    
    return token

@app.get("/api/cases")
async def get_cases(token: str = Depends(verify_clerk_token)):
    # Cases endpoint
    pass
```

---

## 12. Troubleshooting

### Issue: "Publishable key is missing"
**Solution**: Check `.env.local` has `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`

### Issue: "Invalid redirect URL"
**Solution**: Add URL to Clerk Dashboard → Settings → Allowed Redirect URLs

### Issue: Sign out not working
**Solution**: Ensure `CLERK_SECRET_KEY` is set in `.env.local`

### Issue: Social login fails
**Solution**: Verify OAuth credentials are correct in Clerk Dashboard

---

## 13. Production Deployment

### Before Deploying
1. ✅ Set environment variables in production
2. ✅ Update redirect URLs for production domain
3. ✅ Disable test keys
4. ✅ Enable MFA if required
5. ✅ Configure email templates
6. ✅ Test all authentication flows

### Environment Variables (Production)
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
```

---

## 14. Additional Resources

- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Next.js Guide](https://clerk.com/docs/quickstarts/nextjs)
- [Clerk API Reference](https://clerk.com/docs/reference/backend-api)
- [Clerk Security Best Practices](https://clerk.com/docs/security)

---

## Support

For issues:
1. Check Clerk Dashboard logs
2. Review error messages in browser console
3. Consult Clerk documentation
4. Contact Clerk support

---

**Last Updated**: 2026-07-07
**Version**: 1.0.0
