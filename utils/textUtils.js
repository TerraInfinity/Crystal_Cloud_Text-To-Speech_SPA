
/**
 * Parse plain text from HTML content
 * @param {string} html - HTML content to parse
 * @returns {string} - Plain text extracted from HTML
 */
export function parseTextFromHtml(html) {
  // Simple HTML parser (for client-side use)
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Remove script and style elements
    const scripts = doc.querySelectorAll('script, style, noscript, iframe, object, embed');
    scripts.forEach(script => script.remove());
    
    // Extract text from body
    return doc.body.textContent || '';
  }
  
  // For server-side, use a basic regex approach
  // Remove all HTML tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#039;/g, "'");
  
  // Normalize whitespace
  text = text.replace(/\s+/g, ' ');
  
  // Trim leading/trailing whitespace
  return text.trim();
}

/**
 * Extract sections from text based on headings or markers
 * @param {string} text - Input text to parse
 * @param {string[]} sectionMarkers - Array of section marker strings to look for
 * @returns {Object} - Object with sections
 */
export function extractSections(text, sectionMarkers) {
  const sections = {};
  
  // Initialize all sections with empty text
  sectionMarkers.forEach(marker => {
    sections[marker] = '';
  });
  
  // Simple parsing for section markers
  let currentSection = null;
  const lines = text.split('\n');
  
  for (const line of lines) {
    // Check if line contains a section marker
    const markerMatch = sectionMarkers.find(marker => 
      line.toLowerCase().includes(marker.toLowerCase())
    );
    
    if (markerMatch) {
      currentSection = markerMatch;
      continue;
    }
    
    // Add line to current section if one is active
    if (currentSection) {
      sections[currentSection] += sections[currentSection] ? '\n' + line : line;
    }
  }
  
  return sections;
}

/**
 * Process text for special tags (voice and sound effects)
 * @param {string} text - Input text to process
 * @returns {Object} - Object with processed text and settings
 */
export function processVoiceTags(text) {
  let currentIndex = 0;
  
  // Process sound effect tags
  const soundTagRegex = /\[sound:([^\]]+)\]/g;
  const soundEffects = [];
  let match;
  
  // Find all sound effect tags and their positions
  while ((match = soundTagRegex.exec(text)) !== null) {
    soundEffects.push({
      placeholder: match[1],
      position: match.index
    });
  }
  
  // Remove sound tags from text
  const textWithoutSounds = text.replace(soundTagRegex, '');
  
  // Process voice tags on the cleaned text
  const voiceTagRegex = /\[voice:([^\]]+)\]/g;
  const voiceSettings = [];
  
  // Find all voice tags and their positions
  while ((match = voiceTagRegex.exec(text)) !== null) {
    voiceSettings.push({
      voice: match[1],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  // Remove all voice tags from text
  const cleanText = text.replace(voiceTagRegex, '');
  
  return {
    text: cleanText,
    voiceSettings
  };
}
