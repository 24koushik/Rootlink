const fetch = require('node-fetch');
const prompt = "RESPOND ONLY IN PURE JSON: {\"structuredSummary\": {\"keyInsights\": [\"Insight 1\", \"Insight 2\"], \"sections\": [], \"formulas\": []}, \"entities\": []}"; 
fetch('https://text.pollinations.ai/', { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' }, 
  body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], jsonMode: true, model: 'mistral' }) 
})
.then(r => r.text())
.then(t => console.log('POLLINATIONS OUTPUT:', t))
.catch(console.error);
