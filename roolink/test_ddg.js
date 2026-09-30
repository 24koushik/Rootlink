async function testDDG() {
  try {
    const statusRes = await fetch('https://duckduckgo.com/duckchat/v1/status', {
      headers: { 'x-vqd-accept': '1' }
    });
    const vqd = statusRes.headers.get('x-vqd-4');
    console.log('VQD:', vqd);
    if (!vqd) return;

    const chatRes = await fetch('https://duckduckgo.com/duckchat/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vqd-4': vqd
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Say hello in pure JSON: {"message": "hello"}' }]
      })
    });
    
    const text = await chatRes.text();
    console.log('CHAT RESPONSE:', text);
  } catch (e) {
    console.error(e);
  }
}
testDDG();
