export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }
  
  const { audioUrls } = req.body;
  
  if (!audioUrls || !Array.isArray(audioUrls) || audioUrls.length === 0) {
    return res.status(400).json({ message: 'Audio URLs array is required' });
  }
  
  try {
    // This is a server-side endpoint for merging audio
    // Since we can't use the Web Audio API directly on the server,
    // we're returning a signal to do the merging on the client side
    return res.status(200).json({
      mergeOnClient: true,
      audioUrls,
      mergedAudioUrl: `/api/getMergedAudio?ids=${audioUrls.map(url => encodeURIComponent(url)).join(',')}`
    });
  } catch (error) {
    return res.status(500).json({ message: `Error merging audio: ${error.message}` });
  }
}
