import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getTodaysBirthdays, formatBirthdayMessage } from '@/lib/utils/birthdayUtils';
import webpush from 'web-push';

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:admin@example.com', // Replace with your email
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

export async function POST(request: NextRequest) {
  try {
    // Check for API key authorization
    const authHeader = request.headers.get('authorization');
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const supabase = await createClient();
    
    // Get today's birthdays
    const birthdays = await getTodaysBirthdays(supabase);
    
    if (birthdays.length === 0) {
      return NextResponse.json({ message: 'No birthdays today' });
    }
    
    // Get all push subscriptions
    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from('push_subscriptions')
      .select('*');
    
    if (subscriptionsError) {
      console.error('Error fetching push subscriptions:', subscriptionsError);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No push subscriptions found' });
    }
    
    // Send push notifications for each birthday
    const notificationPromises = birthdays.map(async (birthday) => {
      const message = formatBirthdayMessage(birthday);
      
      // Send to all subscriptions
      const pushPromises = subscriptions.map(async (subscription) => {
        try {
          // Skip sending notification to the person whose birthday it is
          if (subscription.user_id === birthday.id) {
            return { success: true, skipped: true };
          }
          
          // Reconstruct the subscription object
          const pushSubscription = {
            endpoint: subscription.endpoint,
            keys: {
              p256dh: subscription.p256dh,
              auth: subscription.auth,
            },
          };
          
          // Send the notification
          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify({
              title: 'Birthday Notification',
              body: message,
              icon: '/icons/txb icon-6.png',
            })
          );
          
          return { success: true };
        } catch (error) {
          console.error('Error sending push notification:', error);
          
          // If the subscription is invalid, remove it
          if (error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', subscription.id);
          }
          
          return { success: false, error };
        }
      });
      
      const results = await Promise.all(pushPromises);
      return {
        birthday: birthday.full_name,
        results,
      };
    });
    
    const results = await Promise.all(notificationPromises);
    
    return NextResponse.json({
      message: `Sent birthday notifications for ${birthdays.length} birthdays`,
      results,
    });
  } catch (error) {
    console.error('Error in birthday notification endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
