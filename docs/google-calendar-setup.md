# Google Calendar OAuth setup

TagOnce uses server-side Google OAuth with the read-only Calendar Events scope. Calendar tokens are encrypted into an HTTP-only cookie and are never written to browser storage.

## 1. Create a Google Cloud project

1. Open Google Cloud Console.
2. Create or select a project for TagOnce.
3. Enable **Google Calendar API**.
4. Configure the OAuth consent screen.
5. During testing, add your Google account under **Test users**.

## 2. Create an OAuth client

Create an OAuth client with application type **Web application**.

Add this authorized redirect URI using the exact public TagOnce domain:

```text
https://YOUR-TAGONCE-DOMAIN/api/google-calendar/callback
```

The protocol, host, path, and trailing slash must match exactly.

## 3. Add Vercel environment variables

In the TagOnce Vercel project, add these variables for Production and Preview as appropriate:

```text
GOOGLE_CALENDAR_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_CALENDAR_REDIRECT_URI=https://YOUR-TAGONCE-DOMAIN/api/google-calendar/callback
CALENDAR_SESSION_SECRET=generate-a-long-random-secret
```

Generate `CALENDAR_SESSION_SECRET` with a password manager or a command such as:

```bash
openssl rand -base64 48
```

Do not commit real secrets to GitHub.

## 4. Redeploy

Redeploy TagOnce after saving the environment variables. Scan a TagOnce card, open **Where did you meet?**, and choose **Connect Google Calendar**.

The app searches the primary calendar for events that are happening now, starting within three hours, or ended within two hours. It suggests up to three matches and never overwrites the meeting field until the user selects one.
