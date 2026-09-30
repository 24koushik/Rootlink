const prompt = "Please summarize this text: 'This video is about making Java methods. I will show you how to make a dog object.' Respond ONLY with a valid JSON object matching this schema: {\"structuredSummary\": {\"keyInsights\": [\"insight 1\", \"insight 2\"], \"sections\": [{\"heading\": \"Main\", \"points\": [\"Point 1\"]}]}, \"formulas\": [], \"entities\": []}"; 
fetch('https://text.pollinations.ai/', { 
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' }, 
  body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }) 
})
.then(r => r.text())
.then(t => console.log('POLLINATIONS OUTPUT:', t))
.catch(console.error);
