// Script to trigger birthday notifications
// This can be run as a cron job daily

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Get the API URL and cron secret from environment variables
const API_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('CRON_SECRET environment variable is not set');
  process.exit(1);
}

// Function to trigger the birthday notifications API
async function triggerBirthdayNotifications() {
  return new Promise((resolve, reject) => {
    const url = `${API_URL}/api/push/birthday`;
    
    // Options for the HTTP request
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    };
    
    // Make the HTTP request
    const req = https.request(url, options, (res) => {
      let data = '';
      
      // Collect the response data
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      // Process the response when it's complete
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Birthday notifications triggered successfully');
          console.log('Response:', data);
          resolve(data);
        } else {
          console.error(`Error triggering birthday notifications: ${res.statusCode}`);
          console.error('Response:', data);
          reject(new Error(`HTTP error ${res.statusCode}`));
        }
      });
    });
    
    // Handle request errors
    req.on('error', (error) => {
      console.error('Error triggering birthday notifications:', error);
      reject(error);
    });
    
    // End the request
    req.end();
  });
}

// Run the function
triggerBirthdayNotifications()
  .then(() => {
    console.log('Done');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
