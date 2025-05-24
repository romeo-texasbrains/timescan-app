'use client'

import { useState, useEffect, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Database } from '@/lib/supabase/database.types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner'
import { useTimezone } from '@/context/TimezoneContext'

// Define a type for settings based on the new table definition
type AppSettings = Database['public']['Tables']['app_settings']['Row']

// Common IANA Timezones (subset for better UX)
// You can expand this list or use a library for a full searchable list
const commonTimezones = [
  "UTC",
  "GMT",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Honolulu",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
];

interface SettingsPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default function AdminSettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = createClient();
  const [settings, setSettings] = useState<Partial<AppSettings>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedTimezone, setSelectedTimezone] = useState<string | undefined>(undefined);

  // Fetch initial settings (including timezone)
  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoading(true);

      // Default values to use if fetching fails
      let companyName = 'Default Company Name';
      let defaultHours = 8;
      let timezone = 'UTC';

      try {
        // Try to fetch general settings
        try {
          const { data: generalData, error: generalError } = await supabase
            .from('app_settings')
            .select('company_name, default_hours, timezone')
            .eq('id', 1)
            .maybeSingle();

          if (!generalError && generalData) {
            // Use data if available
            companyName = generalData.company_name || companyName;
            defaultHours = generalData.default_hours || defaultHours;
            timezone = generalData.timezone || timezone;
          } else if (generalError && generalError.code !== 'PGRST116') {
            // Log error but continue
            console.warn("Warning fetching general settings:", generalError);
          }
        } catch (generalFetchError) {
          console.warn("Exception fetching general settings:", generalFetchError);
        }

        // Use timezone from context instead of making API call
        // The TimezoneContext already has the timezone from server-side rendering

        // Use timezone from context
        const contextTimezone = timezoneContext.timezone || 'UTC';

        // Set the state with whatever we managed to get
        setSettings({
          company_name: companyName,
          default_hours: defaultHours,
          timezone: contextTimezone
        });
        setSelectedTimezone(contextTimezone);

      } catch (error: any) {
        console.error("Failed to load settings:", error);
        // Set defaults even on error
        setSettings({ company_name: companyName, default_hours: defaultHours, timezone: timezone });
        setSelectedTimezone(timezone);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [supabase]);

  // Handle General Settings Update (simplified, could be a separate form/action)
  const handleGeneralSettingsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const companyName = formData.get('company_name') as string;
    const defaultHoursString = formData.get('default_hours') as string;
    const defaultHours = parseFloat(defaultHoursString);

    if (isNaN(defaultHours) || defaultHours <= 0 || defaultHours > 24) {
        toast.error('Invalid default hours value.');
        return;
    }

    startTransition(async () => {
        try {
            // First check if the record exists
            const { data: existingSettings, error: checkError } = await supabase
              .from('app_settings')
              .select('id')
              .eq('id', 1)
              .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
              console.warn('Error checking app_settings:', checkError);
            }

            let updateResult;

            if (!existingSettings) {
              // Insert a new record if none exists
              updateResult = await supabase
                .from('app_settings')
                .insert({
                  id: 1,
                  company_name: companyName,
                  default_hours: defaultHours,
                  timezone: settings.timezone || 'UTC'
                });
            } else {
              // Update existing record
              updateResult = await supabase
                .from('app_settings')
                .update({ company_name: companyName, default_hours: defaultHours })
                .eq('id', 1);
            }

            if (updateResult.error) {
              throw updateResult.error;
            }

            toast.success('General settings saved successfully.');
            // Update local state
            setSettings(prev => ({...prev, company_name: companyName, default_hours: defaultHours }));
        } catch (error: any) {
            console.error("Error saving general settings:", error);
            toast.error(`Failed to save general settings: ${error.message}`);
        }
    });
  };

  // Import the useTimezone hook
  const { setTimezone: setContextTimezone } = useTimezone();

  // Handle Timezone Update
  const handleTimezoneSave = async () => {
    if (!selectedTimezone) {
        toast.warning('Please select a timezone.');
        return;
    }

    startTransition(async () => {
        try {
            setIsSaving(true);

            const response = await fetch('/api/settings/timezone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ timezone: selectedTimezone }),
            });

            // Check if response is ok before trying to parse JSON
            if (!response.ok) {
                let errorMessage = 'Failed to update timezone';
                try {
                    const errorData = await response.json();
                    if (errorData && errorData.message) {
                        errorMessage = errorData.message;
                    }
                } catch (parseError) {
                    console.error("Error parsing error response:", parseError);
                    // Use status text if JSON parsing fails
                    errorMessage = `Server error: ${response.status} ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            // Parse JSON response
            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                console.error("Error parsing success response:", parseError);
                throw new Error("Invalid response from server");
            }

            toast.success(data?.message || 'Timezone updated successfully!');

            // Update local state
            setSettings(prev => ({ ...prev, timezone: selectedTimezone }));

            // Update the context timezone
            setContextTimezone(selectedTimezone);

            // Clear the timezone manager cache to ensure fresh data
            const { ClientTimezoneManager } = await import('@/lib/utils/timezone-client');
            ClientTimezoneManager.getInstance().clearCache();
        } catch (error: any) {
            console.error("Error updating timezone:", error);
            toast.error(`Failed to update timezone: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    });
  };

  // Display loading state
  if (isLoading) {
    return <div className="container mx-auto px-4 py-6 text-center">Loading settings...</div>
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Application Settings</h1>
        <Link href="/admin">
          <Button variant="outline">Back to Admin</Button>
        </Link>
      </div>

      {/* General Settings Card */}
      <Card className="max-w-2xl mx-auto mb-6">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGeneralSettingsSubmit} className="space-y-6">
            {/* Company Name */}
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                name="company_name"
                defaultValue={settings.company_name ?? ''}
                required
                disabled={isSaving}
              />
              <p className="text-sm text-muted-foreground">The name displayed throughout the application.</p>
            </div>

            {/* Default Work Hours */}
            <div className="space-y-2">
              <Label htmlFor="default_hours">Default Work Hours per Day</Label>
              <Input
                id="default_hours"
                name="default_hours"
                type="number"
                defaultValue={settings.default_hours ?? 8}
                min="1"
                max="24"
                step="0.5"
                required
                disabled={isSaving}
              />
              <p className="text-sm text-muted-foreground">Used for calculations like overtime (if implemented).</p>
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isSaving || isPending}>{isSaving || isPending ? 'Saving...' : 'Save General Settings'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Timezone Settings Card */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Timezone Setting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
           <p className="text-sm text-muted-foreground">Set the global timezone for displaying dates and times across the application.</p>
           <div className="space-y-2">
             <Label htmlFor="timezone-select">Application Timezone</Label>
              <Select
                value={selectedTimezone}
                onValueChange={setSelectedTimezone}
                disabled={isSaving}
              >
                <SelectTrigger id="timezone-select">
                  <SelectValue placeholder="Select timezone..." />
                </SelectTrigger>
                <SelectContent>
                  {commonTimezones.map(tz => (
                    <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
           </div>
           <div className="flex justify-end pt-2">
             <Button onClick={handleTimezoneSave} disabled={isSaving || isPending || selectedTimezone === settings.timezone}>
               {isSaving || isPending ? 'Saving...' : 'Save Timezone'}
             </Button>
           </div>
        </CardContent>
      </Card>

    </div>
  )
}