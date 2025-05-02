export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { text, prompt, provider } = req.body;
  
  if (!text) {
    return res.status(400).json({ message: 'Text is required' });
  }
  
  if (!prompt) {
    return res.status(400).json({ message: 'Prompt is required' });
  }
  
  try {
    // Check provider and API keys
    if (provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY || req.headers['x-openai-api-key'];
      
      if (!apiKey) {
        return res.status(400).json({ message: 'OpenAI API key is required' });
      }
      
      // Call OpenAI API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant that processes text based on instructions.'
            },
            {
              role: 'user',
              content: `${prompt}\n\nText to process:\n${text}`
            }
          ],
          temperature: 0.7,
          max_tokens: 2000
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error calling OpenAI API');
      }
      
      const data = await response.json();
      const result = data.choices[0]?.message?.content || '';
      
      return res.status(200).json({ result });
      
    } else if (provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY || req.headers['x-anthropic-api-key'];
      
      if (!apiKey) {
        return res.status(400).json({ message: 'Anthropic API key is required' });
      }
      
      // Call Anthropic API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-2',
          messages: [
            {
              role: 'user',
              content: `${prompt}\n\nText to process:\n${text}`
            }
          ],
          max_tokens: 2000
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Error calling Anthropic API');
      }
      
      const data = await response.json();
      const result = data.content?.[0]?.text || '';
      
      return res.status(200).json({ result });
      
    } else {
      return res.status(400).json({ message: 'Unsupported AI provider' });
    }
  } catch (error) {
    return res.status(500).json({ message: `Error processing with AI: ${error.message}` });
  }
}
