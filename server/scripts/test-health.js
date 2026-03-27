/**
 * Quick health check - run while server is up
 * Usage: node scripts/test-health.js
 */
const base = process.env.API_URL || 'http://localhost:3001';
fetch(`${base}/api/health`)
  .then(r => r.json())
  .then(d => {
    if (d.ok) {
      console.log('OK: Health check passed', d.db ? `(db: ${d.db})` : '');
      process.exit(0);
    }
    console.error('FAIL: Unexpected response', d);
    process.exit(1);
  })
  .catch(e => {
    console.error('FAIL: Could not reach server', e.message);
    process.exit(1);
  });
