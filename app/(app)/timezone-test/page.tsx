'use client';

import { useEffect, useState } from 'react';
import { useTimezone } from '@/context/TimezoneContext';
import { ClientTimezoneManager } from '@/lib/utils/timezone-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function TimezoneTestPage() {
  const { timezone, isLoading } = useTimezone();
  const [managerInfo, setManagerInfo] = useState<any>({});
  const [testResults, setTestResults] = useState<string[]>([]);

  const refreshManagerInfo = () => {
    const manager = ClientTimezoneManager.getInstance();
    setManagerInfo(manager.getDebugInfo());
  };

  useEffect(() => {
    refreshManagerInfo();
    const interval = setInterval(refreshManagerInfo, 1000);
    return () => clearInterval(interval);
  }, []);

  const addTestResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const runTests = async () => {
    setTestResults([]);
    addTestResult('Starting timezone tests...');

    // Test 1: Multiple useTimezone calls
    addTestResult('Test 1: Multiple useTimezone calls');
    const manager = ClientTimezoneManager.getInstance();
    const initialRequestCount = manager.getDebugInfo().requestCount;
    
    // Simulate multiple components calling useTimezone
    for (let i = 0; i < 5; i++) {
      const tz = await manager.getTimezone();
      addTestResult(`Call ${i + 1}: Got timezone ${tz}`);
    }
    
    const finalRequestCount = manager.getDebugInfo().requestCount;
    const newRequests = finalRequestCount - initialRequestCount;
    addTestResult(`Result: ${newRequests} new API requests (should be 0 if cache is working)`);

    // Test 2: Force refresh
    addTestResult('Test 2: Force refresh');
    const beforeRefresh = manager.getDebugInfo().requestCount;
    await manager.getTimezone(true);
    const afterRefresh = manager.getDebugInfo().requestCount;
    const refreshRequests = afterRefresh - beforeRefresh;
    addTestResult(`Result: ${refreshRequests} API requests for force refresh (should be 1)`);

    addTestResult('Tests completed!');
    refreshManagerInfo();
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Timezone Performance Test</h1>
        <p className="text-muted-foreground">Test timezone caching and API call optimization</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current State */}
        <Card>
          <CardHeader>
            <CardTitle>Current State</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div><strong>Context Timezone:</strong> {timezone}</div>
            <div><strong>Context Loading:</strong> {isLoading ? 'Yes' : 'No'}</div>
            <div><strong>Manager Timezone:</strong> {managerInfo.timezone}</div>
            <div><strong>Manager Initialized:</strong> {managerInfo.isInitialized ? 'Yes' : 'No'}</div>
            <div><strong>Cache Age:</strong> {Math.round(managerInfo.cacheAge / 1000)}s</div>
            <div><strong>Total API Requests:</strong> {managerInfo.requestCount}</div>
            <div><strong>Pending Request:</strong> {managerInfo.hasPendingRequest ? 'Yes' : 'No'}</div>
          </CardContent>
        </Card>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={runTests} className="w-full">
              Run Performance Tests
            </Button>
            <Button 
              onClick={() => {
                const manager = ClientTimezoneManager.getInstance();
                manager.clearCache();
                addTestResult('Cache cleared');
                refreshManagerInfo();
              }}
              variant="outline"
              className="w-full"
            >
              Clear Cache
            </Button>
            <Button 
              onClick={() => {
                setTestResults([]);
                addTestResult('Test results cleared');
              }}
              variant="outline"
              className="w-full"
            >
              Clear Results
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Test Results */}
      <Card>
        <CardHeader>
          <CardTitle>Test Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md max-h-96 overflow-y-auto">
            {testResults.length === 0 ? (
              <p className="text-muted-foreground">No test results yet. Click "Run Performance Tests" to start.</p>
            ) : (
              <div className="space-y-1">
                {testResults.map((result, index) => (
                  <div key={index} className="text-sm font-mono">
                    {result}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expected Results */}
      <Card>
        <CardHeader>
          <CardTitle>Expected Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><strong>✅ Good Performance:</strong></div>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Total API Requests: 1-2 (only initial load)</li>
              <li>Multiple useTimezone calls: 0 new requests</li>
              <li>Cache Age: Increases over time</li>
              <li>Force refresh: Exactly 1 new request</li>
            </ul>
            
            <div className="pt-2"><strong>❌ Poor Performance:</strong></div>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Total API Requests: 10+ (excessive calls)</li>
              <li>Multiple useTimezone calls: Multiple new requests</li>
              <li>Cache Age: Always low (cache not working)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
