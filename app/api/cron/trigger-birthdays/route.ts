import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export async function GET(request: NextRequest) {
  try {
    // Check for authorization
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Call the Netlify function
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/.netlify/functions/trigger-birthdays`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET}`
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: 'Error from Netlify function', 
        status: response.status,
        details: errorText
      }, { status: response.status });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in trigger-birthdays API route:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
