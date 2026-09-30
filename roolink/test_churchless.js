async function testChurchless() {
  try {
    const res = await fetch('https://free.churchless.tech/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say hello in JSON' }]
      })
    });
    const text = await res.text();
    console.log('CHURCHLESS OUTPUT:', text);
  } catch (e) {
    console.error(e);
  }
}
testChurchless();
