'use client';

import { useState, useEffect } from 'react';
import { ClientTimezoneManager } from '@/lib/utils/timezone-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TimezoneDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [isVisible, setIsVisible] = useState(false);

  const refreshDebugInfo = () => {
    const manager = ClientTimezoneManager.getInstance();
    setDebugInfo(manager.getDebugInfo());
  };

  useEffect(() => {
    if (isVisible) {
      refreshDebugInfo();
      const interval = setInterval(refreshDebugInfo, 1000);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(true)}
          variant="outline"
          size="sm"
        >
          Debug Timezone
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Timezone Debug</CardTitle>
            <Button
              onClick={() => setIsVisible(false)}
              variant="ghost"
              size="sm"
            >
              ×
            </Button>
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div><strong>Timezone:</strong> {debugInfo.timezone}</div>
          <div><strong>Initialized:</strong> {debugInfo.isInitialized ? 'Yes' : 'No'}</div>
          <div><strong>Cache Age:</strong> {Math.round(debugInfo.cacheAge / 1000)}s</div>
          <div><strong>API Requests:</strong> {debugInfo.requestCount}</div>
          <div><strong>Pending Request:</strong> {debugInfo.hasPendingRequest ? 'Yes' : 'No'}</div>
          <div className="pt-2 space-y-2">
            <Button
              onClick={refreshDebugInfo}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Refresh
            </Button>
            <Button
              onClick={() => {
                const manager = ClientTimezoneManager.getInstance();
                console.log('Debug: Current manager state:', manager.getDebugInfo());
              }}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Log State
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
