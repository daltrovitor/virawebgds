import { test, expect } from '@playwright/test';

test.describe('Security Checks - SQL Injection Fuzzing', () => {
  // Common SQL injection payloads
  const sqlPayloads = [
    "' OR '1'='1",
    "'; DROP TABLE reminders; --",
    "admin'--",
    "')) OR 1=1--",
    "'; SELECT pg_sleep(5); --", // Time-based blind injection attempt
  ];

  test('should handle malicious payloads in reminder title as plain text', async ({ page }) => {
    // Note: You need to be logged in. This test assumes you are on the dashboard.
    // Replace with your local dev URL
    await page.goto('http://localhost:3000/pt-BR/dashboard/reminders');

    for (const payload of sqlPayloads) {
      console.log(`Testing payload: ${payload}`);
      
      // Fill the form
      await page.fill('input[placeholder*="Reunião"]', payload);
      await page.fill('input[placeholder*="Lembrar de faturar"]', 'Security test body');
      
      // Set a future date/time to avoid validation error
      await page.fill('input[type="date"]', '2026-12-31');
      await page.fill('input[type="time"]', '12:00');

      // Intercept the request to Check the body
      const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/rest/v1/reminders') && res.status() === 201),
        page.click('button:has-text("Agendar")'),
      ]);

      const requestBody = JSON.parse(response.request().postData() || '{}');
      
      // Verification: The payload should be present in the JS object SENT to Supabase,
      // proving it's being treated as data, not code.
      expect(requestBody.title).toBe(payload);
      
      // Clean up: delete the reminder we just created (optional but good practice)
      await page.click('button:has-text("asd")'); // This would need a more specific selector
    }
  });
});
