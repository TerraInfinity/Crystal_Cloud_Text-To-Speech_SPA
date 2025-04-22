/**
 * AI Service for transforming text using different AI providers
 */
class AIService {
  /**
   * Transform text using OpenAI (ChatGPT)
   * @param {string} text - Text to transform
   * @param {string} prompt - Instruction prompt for the AI
   * @param {string} apiKey - OpenAI API key
   * @returns {Promise<string>} - Promise resolving to transformed text
   */
  async transformWithOpenAI(text, prompt, apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    try {
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
        throw new Error(error.error?.message || `OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      throw error;
    }
  }

  /**
   * Transform text using Anthropic (Claude)
   * @param {string} text - Text to transform
   * @param {string} prompt - Instruction prompt for the AI
   * @param {string} apiKey - Anthropic API key
   * @returns {Promise<string>} - Promise resolving to transformed text
   */
  async transformWithAnthropic(text, prompt, apiKey) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }

    try {
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
        throw new Error(error.error?.message || `Anthropic API error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || '';
    } catch (error) {
      throw error;
    }
  }

  /**
   * Extract sections from text based on presets
   * @param {string} text - Text to process
   * @param {string} preset - Preset type ('yoga', 'general', etc.)
   * @param {string} provider - AI provider to use ('openai', 'anthropic')
   * @param {Object} options - Additional options (apiKeys, etc.)
   * @returns {Promise<Object>} - Promise resolving to extracted sections
   */
  async extractSections(text, preset, provider, options = {}) {
    let prompt;
    
    // Define prompts based on presets
    if (preset === 'yoga') {
      prompt = 'Extract and organize the following Yoga Kriya practice into these sections: ' +
        'Tuning In, Warm-Up, Kriya Sequence, Relaxation, Meditation, and Closing. ' +
        'Keep the original instructions intact but separate them into the appropriate sections. ' +
        'Format the output as a JSON with section titles as keys and the content as values.';
    } else {
      prompt = 'Organize the following text into logical sections. ' +
        'Create appropriate section titles and group the content under them. ' +
        'Format the output as a JSON with section titles as keys and the content as values.';
    }
    
    // Use the appropriate AI provider
    let result;
    if (provider === 'openai') {
      result = await this.transformWithOpenAI(text, prompt, options.openaiApiKey);
    } else if (provider === 'anthropic') {
      result = await this.transformWithAnthropic(text, prompt, options.anthropicApiKey);
    } else {
      throw new Error('Unsupported AI provider');
    }
    
    // Parse the result as JSON if possible
    try {
      // Find JSON in the response (may be surrounded by text)
      const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/) || result.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : result;
      
      return JSON.parse(jsonStr);
    } catch (error) {
      // If parsing fails, return the raw result
      console.error('Error parsing AI response as JSON:', error);
      return { 'Extracted Text': result };
    }
  }

  /**
   * Simplify text for easier understanding
   * @param {string} text - Text to simplify
   * @param {string} provider - AI provider to use ('openai', 'anthropic')
   * @param {Object} options - Additional options (apiKeys, etc.)
   * @returns {Promise<string>} - Promise resolving to simplified text
   */
  async simplifyText(text, provider, options = {}) {
    const prompt = 'Simplify the following text to make it easier to understand ' +
      'while preserving all important information and instructions.';
    
    if (provider === 'openai') {
      return this.transformWithOpenAI(text, prompt, options.openaiApiKey);
    } else if (provider === 'anthropic') {
      return this.transformWithAnthropic(text, prompt, options.anthropicApiKey);
    } else {
      throw new Error('Unsupported AI provider');
    }
  }

  /**
   * Format text for optimal speech synthesis
   * @param {string} text - Text to format
   * @param {string} provider - AI provider to use ('openai', 'anthropic')
   * @param {Object} options - Additional options (apiKeys, etc.)
   * @returns {Promise<string>} - Promise resolving to formatted text
   */
  async formatForSpeech(text, provider, options = {}) {
    const prompt = 'Format the following text to be more suitable for text-to-speech conversion. ' +
      'Add pauses (using commas and periods), spell out abbreviations, and remove any visual elements ' +
      'that wouldn\'t make sense when heard. Add pronunciation guidance for unusual words if needed.';
    
    if (provider === 'openai') {
      return this.transformWithOpenAI(text, prompt, options.openaiApiKey);
    } else if (provider === 'anthropic') {
      return this.transformWithAnthropic(text, prompt, options.anthropicApiKey);
    } else {
      throw new Error('Unsupported AI provider');
    }
  }

  /**
   * Process text with a custom prompt
   * @param {string} text - Text to process
   * @param {string} customPrompt - Custom instruction prompt
   * @param {string} provider - AI provider to use ('openai', 'anthropic')
   * @param {Object} options - Additional options (apiKeys, etc.)
   * @returns {Promise<string>} - Promise resolving to processed text
   */
  async processWithCustomPrompt(text, customPrompt, provider, options = {}) {
    if (provider === 'openai') {
      return this.transformWithOpenAI(text, customPrompt, options.openaiApiKey);
    } else if (provider === 'anthropic') {
      return this.transformWithAnthropic(text, customPrompt, options.anthropicApiKey);
    } else {
      throw new Error('Unsupported AI provider');
    }
  }
}

// Export a singleton instance
export default new AIService();
