// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CREATE_NODE') {
    // Send data to Next.js API
    fetch('http://localhost:3000/api/nodes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request.payload)
    })
    .then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          let errorMessage = `HTTP Error ${response.status}`;
          try {
            const errObj = JSON.parse(text);
            if (errObj.error) errorMessage = errObj.error;
          } catch (e) {
            errorMessage = text || errorMessage;
          }
          throw new Error(errorMessage);
        });
      }
      return response.json();
    })
    .then(data => {
      sendResponse({ status: 'success', data });
    })
    .catch(error => {
      console.error('Roolink Backend Error:', error);
      sendResponse({ status: 'error', message: error.message || error.toString() });
    });

    return true; 
  }

  if (request.type === 'FETCH_TRANSCRIPT') {
    fetch(request.url)
      .then(res => {
        if (!res.ok) throw new Error(`YouTube returned status ${res.status}`);
        return res.text();
      })
      .then(data => sendResponse({ status: 'success', data }))
      .catch(error => {
        console.error('Roolink Fetch Transcript Error:', error);
        sendResponse({ status: 'error', message: error.message || error.toString() });
      });

    return true;
  }
});
