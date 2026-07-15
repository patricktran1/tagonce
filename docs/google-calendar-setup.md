# Google Calendar setup

TagOnce uses Google Identity Services in the browser with the read-only Calendar Events scope. It does not use a Calendar serverless function, client secret, redirect callback, or refresh token.

## 1. Google Cloud project

1. Open Google Cloud Console.
2. Create or select the TagOnce project.
3. Enable **Google Calendar API**.
4. Configure the OAuth consent screen.
5. During testing, add your Google account under **Test users**.
6. Add this scope under **Data access**:

```text
https://www.googleapis.com/auth/calendar.events.readonly
```

## 2. OAuth client

Create an OAuth client with application type **Web application**.

Add the production TagOnce origin under **Authorized JavaScript origins**:

```text
https://tagonce.vercel.app
```

Do not add a path or trailing slash to the JavaScript origin.

The former `/api/google-calendar/callback` redirect URI is no longer used by TagOnce and can be removed.

## 3. Client ID

The Google OAuth Client ID is a public browser identifier, not a secret. There are two supported options.

### Production option

Add this Vercel environment variable and redeploy:

```text
VITE_GOOGLE_CALENDAR_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### Immediate testing option

Press **Connect calendar** in TagOnce and paste the OAuth Client ID when prompted. TagOnce stores that public client ID in the browser for future visits.

Do not paste or expose the Google client secret. TagOnce does not need it for this browser authorization flow.

## 4. Test

1. Create a timed event in the primary Google Calendar that is happening now or begins within three hours.
2. Give it a title and location.
3. Open **Live event** in TagOnce.
4. Connect Google Calendar and approve read-only event access.
5. Select **Make this my Event QR**.

TagOnce searches the primary calendar for events happening now, starting within three hours, ending within the last two hours, or occurring today. It ranks title matches and events with locations higher.

The browser access token is short-lived. TagOnce may ask the user to reconnect after it expires.
