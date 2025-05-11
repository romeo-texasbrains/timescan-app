# Setting Up Birthday Notification Cron Jobs

This document explains how to set up cron jobs to trigger daily birthday notifications in the TimeScan app.

## Option 1: GitHub Actions (Recommended)

The repository includes a GitHub Actions workflow that will automatically trigger birthday notifications daily at 8:00 AM UTC.

### Setup Steps:

1. Push your code to GitHub
2. In your GitHub repository, go to Settings > Secrets and variables > Actions
3. Add the following secrets:
   - `NEXT_PUBLIC_SITE_URL`: The URL of your deployed site (e.g., https://your-site.com)
   - `CRON_SECRET`: The secret key used to authenticate cron job requests (from your .env.local file)
4. The workflow will now run automatically every day at 8:00 AM UTC

You can also manually trigger the workflow by going to the Actions tab in your GitHub repository, selecting the "Daily Birthday Notifications" workflow, and clicking "Run workflow".

## Option 2: Traditional Cron Job

If you have access to a server with cron, you can set up a traditional cron job.

### Setup Steps:

1. Copy the `scripts/trigger-birthday-notifications.js` file to your server
2. Install Node.js and the required dependencies:
   ```bash
   npm install dotenv
   ```
3. Create a `.env.local` file with the following variables:
   ```
   NEXT_PUBLIC_SITE_URL=https://your-site.com
   CRON_SECRET=your-cron-secret-key
   ```
4. Add a cron job to run the script daily:
   ```bash
   # Edit crontab
   crontab -e
   
   # Add this line to run at 8:00 AM every day
   0 8 * * * cd /path/to/script && node trigger-birthday-notifications.js >> /path/to/logs/cron.log 2>&1
   ```

## Option 3: Vercel Cron Jobs

If you're deploying to Vercel, you can use Vercel Cron Jobs.

### Setup Steps:

1. Create a file at `app/api/cron/birthday/route.ts` with the following content:
   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   
   export const config = {
     runtime: 'edge',
   };
   
   export async function GET(request: NextRequest) {
     // Check for Vercel Cron authentication
     const authHeader = request.headers.get('Authorization');
     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
     }
     
     // Call the birthday notification API
     const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/push/birthday`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${process.env.CRON_SECRET}`
       }
     });
     
     const data = await response.json();
     return NextResponse.json(data);
   }
   ```

2. Add the following to your `vercel.json` file:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/birthday",
         "schedule": "0 8 * * *"
       }
     ]
   }
   ```

3. Add the environment variables to your Vercel project:
   - `NEXT_PUBLIC_SITE_URL`
   - `CRON_SECRET`

## Testing the Cron Job

To test the cron job locally, run:

```bash
node scripts/trigger-birthday-notifications.js
```

This will trigger the birthday notifications API endpoint and send notifications for any birthdays today.
