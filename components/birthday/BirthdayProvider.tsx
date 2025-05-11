import { createClient } from '@/lib/supabase/server';
import { getTodaysBirthdays } from '@/lib/utils/birthdayUtils';
import BirthdayNotification from './BirthdayNotification';

export default async function BirthdayProvider() {
  const supabase = await createClient();
  
  // Get today's birthdays
  const birthdays = await getTodaysBirthdays(supabase);
  
  // Pass birthdays to the client component
  return <BirthdayNotification birthdays={birthdays} />;
}
