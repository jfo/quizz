# OAuth Setup Guide (Google & GitHub)

This guide will help you set up Google and GitHub authentication for your quiz app.

## Prerequisites

- A Supabase project (already created)
- Your Supabase project URL (from Settings → API)

## Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter project name: "Quiz App" (or your preferred name)
4. Click **Create**
5. Wait for the project to be created and select it

### Step 2: Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** → **OAuth consent screen**
2. Select **External** (for public apps) and click **Create**
3. Fill in the required fields:
   - **App name**: Quiz App
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**
5. **Scopes**: Click **Add or Remove Scopes**
   - Find and select: `email`, `profile`, `openid`
   - Click **Update** → **Save and Continue**
6. **Test users** (for testing): Add your email address
7. Click **Save and Continue** → **Back to Dashboard**

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ Create Credentials** → **OAuth client ID**
3. Select **Application type**: **Web application**
4. **Name**: "Quiz App Web Client"
5. **Authorized JavaScript origins**:
   - Add: `https://<your-project-ref>.supabase.co`
   - (Find your project-ref in Supabase URL: `https://xxxxx.supabase.co` - use the xxxxx part)
6. **Authorized redirect URIs**:
   - Add: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Example: `https://abcdefghijk.supabase.co/auth/v1/callback`
7. Click **Create**
8. **IMPORTANT**: Copy your **Client ID** and **Client Secret** - you'll need these!

### Step 4: Configure in Supabase

1. Go to your Supabase dashboard
2. Click **Authentication** → **Providers**
3. Find **Google** in the list
4. Toggle **Enable Sign in with Google** to ON
5. Paste your **Client ID** from Google
6. Paste your **Client Secret** from Google
7. Click **Save**

### Step 5: (Optional) Add Localhost for Development

If you want to test OAuth on localhost:

1. Go back to Google Cloud Console → **Credentials**
2. Click your OAuth client
3. Under **Authorized redirect URIs**, add:
   - `http://localhost:5173/auth/v1/callback` (for Vite dev server)
4. Click **Save**

---

## GitHub OAuth Setup

### Step 1: Create a GitHub OAuth App

1. Go to GitHub and click your profile picture → **Settings**
2. Scroll down to **Developer settings** (bottom of left sidebar)
3. Click **OAuth Apps**
4. Click **New OAuth App**

### Step 2: Fill in OAuth App Details

1. **Application name**: Quiz App
2. **Homepage URL**:
   - For production: Your app's URL (e.g., `https://yourusername.github.io/quizz`)
   - For development: `http://localhost:5173`
3. **Application description**: (optional) "Quiz app with progress tracking"
4. **Authorization callback URL**: `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - Example: `https://abcdefghijk.supabase.co/auth/v1/callback`
   - **IMPORTANT**: Use your actual Supabase project reference!
5. Click **Register application**

### Step 3: Generate Client Secret

1. You'll see your **Client ID** on the next page
2. Click **Generate a new client secret**
3. **IMPORTANT**: Copy the **Client Secret** immediately - you won't see it again!
4. Keep this page open or save the credentials somewhere safe

### Step 4: Configure in Supabase

1. Go to your Supabase dashboard
2. Click **Authentication** → **Providers**
3. Find **GitHub** in the list
4. Toggle **Enable Sign in with GitHub** to ON
5. Paste your **Client ID** from GitHub
6. Paste your **Client Secret** from GitHub
7. Click **Save**

---

## Finding Your Supabase Project Reference

Your Supabase project reference is in your project URL:

- **Format**: `https://<project-ref>.supabase.co`
- **Example**: If your URL is `https://abcdefghijk.supabase.co`, your project-ref is `abcdefghijk`

You can find this in:
- Supabase Dashboard → **Settings** → **API** → **Project URL**

---

## Testing OAuth

### Test Google Sign In

1. Start your dev server: `npm run dev`
2. Open your app
3. Click **Sign In / Sign Up**
4. Click **Continue with Google**
5. Select your Google account
6. Grant permissions
7. You should be redirected back to your app, signed in!

### Test GitHub Sign In

1. In the sign-in modal, click **Continue with GitHub**
2. Click **Authorize [your-github-username]**
3. You should be redirected back to your app, signed in!

---

## Troubleshooting

### "Redirect URI mismatch" error (Google)

- Double-check the redirect URI in Google Cloud Console
- Make sure it exactly matches: `https://<your-project-ref>.supabase.co/auth/v1/callback`
- No trailing slash!
- Check that you replaced `<your-project-ref>` with your actual project reference

### "Redirect URI mismatch" error (GitHub)

- Check the callback URL in GitHub OAuth App settings
- Make sure it exactly matches: `https://<your-project-ref>.supabase.co/auth/v1/callback`

### OAuth popup closes immediately

- Check browser console for errors
- Make sure you saved the credentials in Supabase
- Verify your Client ID and Secret are correct

### "Access blocked: This app's request is invalid" (Google)

- Make sure you configured the OAuth consent screen
- Add your email as a test user if the app is in testing mode
- Check that the required scopes (email, profile, openid) are added

### OAuth works in development but not production

For production deployments:

1. **Update Google OAuth**:
   - Add your production domain to Authorized JavaScript origins
   - Example: `https://yourusername.github.io`

2. **Update GitHub OAuth**:
   - Create a separate OAuth app for production OR
   - Update Homepage URL to your production URL

3. **Update Supabase**:
   - Go to **Authentication** → **URL Configuration**
   - Add your production URL to **Site URL**
   - Add it to **Redirect URLs** as well

---

## Security Notes

- **Never commit** your Client Secrets to git
- The Client ID is safe to be public (it's in your frontend code)
- If you accidentally expose a Client Secret:
  - Google: Regenerate it in Cloud Console → Credentials
  - GitHub: Regenerate it in OAuth App settings

---

## Production Checklist

Before deploying to production:

- [ ] Google OAuth configured with production domain
- [ ] GitHub OAuth configured with production domain
- [ ] Supabase Site URL updated
- [ ] Supabase Redirect URLs updated
- [ ] Test sign-in flow in production
- [ ] OAuth consent screen published (Google) - move from Testing to Production

---

## Need Help?

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [GitHub OAuth Documentation](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps)

Happy authenticating! 🎉
