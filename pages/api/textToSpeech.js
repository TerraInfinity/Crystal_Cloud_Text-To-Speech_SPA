export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { text, engine, voice } = req.body;
  
  if (!text) {
    return res.status(400).json({ message: 'Text is required' });
  }
  
  try {
    // Process based on the selected engine
    if (engine === 'webSpeech') {
      // For Web Speech API, we can't directly use it from the server
      // So we'll return a flag to process on the client side
      return res.status(200).json({ 
        useWebSpeech: true,
        text,
        voice,
        audioUrl: `/api/webSpeech?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice || '')}`
      });
      
    } else if (engine === 'elevenLabs') {
      const apiKey = process.env.ELEVENLABS_API_KEY || req.headers['x-elevenlabs-api-key'];
      
      if (!apiKey) {
        return res.status(400).json({ message: 'ElevenLabs API key is required' });
      }
      
      // Default voice ID for ElevenLabs if not specified
      const voiceId = voice || '21m00Tcm4TlvDq8ikWAM'; // Default voice (Rachel)
      
      // Call ElevenLabs API
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75
          }
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail?.message || 'Error calling ElevenLabs API');
      }
      
      // Get the audio data
      const audioBuffer = await response.arrayBuffer();
      
      // Convert to base64
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
      
      return res.status(200).json({ audioUrl });
      
    } else if (engine === 'awsPolly') {
      const accessKey = process.env.AWS_ACCESS_KEY_ID || req.headers['x-aws-access-key'];
      const secretKey = process.env.AWS_SECRET_ACCESS_KEY || req.headers['x-aws-secret-key'];
      
      if (!accessKey || !secretKey) {
        return res.status(400).json({ message: 'AWS credentials are required' });
      }
      
      // For AWS Polly, we would typically use the AWS SDK
      // But since we don't have it installed, we'll return a mock response
      return res.status(200).json({
        audioUrl: `/api/awsPolly?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice || 'Joanna')}`
      });
      
    } else {
      return res.status(400).json({ message: 'Unsupported speech engine' });
    }
  } catch (error) {
    return res.status(500).json({ message: `Error generating speech: ${error.message}` });
  }
}
