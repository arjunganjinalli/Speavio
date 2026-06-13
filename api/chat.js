// api/chat.js — provider-agnostic proxy handler

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body;
    const apiKey = req.headers['authorization']?.replace('Bearer ', '');
    const targetUrl = req.headers['x-target-url'] || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

    if (!apiKey) {
      return res.status(401).json({ error: 'Missing API key' });
    }

    if (typeof targetUrl !== 'string' || !targetUrl.startsWith('https://')) {
      return res.status(400).json({ error: 'Invalid target URL. HTTPS is required.' });
    }

    // Forward request to any OpenAI-compatible chat completions endpoint.
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: body.model || 'glm-3-turbo',
        messages: body.messages,
        temperature: body.temperature || 0.3,
        max_tokens: body.max_tokens || 800
      })
    });

    if (!response.ok) {
      const errData = await response.text();
      return res.status(response.status).json({ error: errData });
    }

    // Parse and return just the AI's reply text
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';
    res.status(200).send(reply);

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy failed: ' + err.message });
  }
}
