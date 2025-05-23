/**
 * @fileoverview Tools component for HTML parsing and AI transformation functionality
 * 
 * This file contains the ToolsTab component which provides utilities for:
 * - Extracting text content from HTML
 * - Fetching and parsing content from URLs 
 * - Applying AI-powered transformations to text content
 * - Using processed content in the main application
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {useTTSContext} from '../context/TTSContext';
import { useTTSSessionContext  } from '../context/TTSSessionContext';
import { parseTextFromHtml } from '../utils/textUtils';
import { devLog, devError } from '../utils/logUtils';
import { useNotification } from '../context/notificationContext';

/**
 * ToolsTab component providing utilities for HTML/URL parsing and AI transformations.
 * Allows users to extract text from HTML/URLs and process text with AI services
 * before using it in the main application.
 *
 * @component
 * @returns {JSX.Element} The rendered ToolsTab component
 */
const ToolsTab = () => {
  const { actions, isProcessing } = useTTSContext();
  const { actions: sessionActions } = useTTSSessionContext ();
  const { addNotification } = useNotification();
  
  // State for HTML/URL parsing
  const [htmlInput, setHtmlInput] = useState('');
  const [parseResult, setParseResult] = useState('');
  
  // State for AI transformation
  const [aiInput, setAiInput] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiProvider, setAiProvider] = useState('openai');
  const [selectedPresetPrompt, setSelectedPresetPrompt] = useState('');
  
  /**
   * Preset prompts available for AI transformation
   * @type {Array<{id: string, label: string, prompt: string}>}
   */
  const presetPrompts = [
    {
      id: 'yoga-extract',
      label: 'Extract Yoga Kriya sections from text',
      prompt: 'Extract and organize the following Yoga Kriya practice into these sections: Tuning In, Warm-Up, Kriya Sequence, Relaxation, Meditation, and Closing. Keep the original instructions intact but separate them into the appropriate sections.'
    },
    {
      id: 'simplify',
      label: 'Simplify text',
      prompt: 'Simplify the following text to make it easier to understand while preserving all important information and instructions.'
    },
    {
      id: 'format-speech',
      label: 'Format for speech',
      prompt: 'Format the following text to be more suitable for text-to-speech conversion. Add pauses (using commas and periods), spell out abbreviations, and remove any visual elements that wouldn\'t make sense when heard.'
    }
  ];
  
  /**
   * Parses HTML or URL input to extract plain text
   * Uses direct HTML parsing for HTML content or API for URL extraction
   * 
   * @async
   */
  const parseHtmlOrUrl = async () => {
    if (!htmlInput.trim()) {
      sessionActions.setError('Please enter HTML or a URL');
      return;
    }
    
    try {
      sessionActions.setProcessing(true);
      
      // Check if input is a URL
      const isUrl = htmlInput.trim().startsWith('http');
      
      if (isUrl) {
        // Process URL using API
        const response = await fetch('/api/extractTextFromUrl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: htmlInput })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to process URL');
        }
        
        const data = await response.json();
        setParseResult(data.text);
      } else {
        // Process HTML directly in the browser
        const plainText = parseTextFromHtml(htmlInput);
        setParseResult(plainText);
      }
      
      // Display notification about successful parsing
      addNotification({
        type: 'success',
        message: `Successfully parsed ${isUrl ? 'URL' : 'HTML'} content`,
      });
    } catch (error) {
      sessionActions.setError(`Error parsing content: ${error.message}`);
    } finally {
      sessionActions.setProcessing(false);
    }
  };
  
  /**
   * Applies the parsed result to the main text input area
   * Sets the active tab to main and shows success notification
   */
  const applyParsedResult = () => {
    if (!parseResult.trim()) {
      sessionActions.setError('No parsed content to apply');
      return;
    }

    sessionActions.setInputText(parseResult);
    addNotification({
      type: 'success',
      message: 'Parsed content applied to input text',
    });
    sessionActions.setActiveTab('main');
  };
  
  /**
   * Handles preset prompt selection and updates the prompt field
   * 
   * @param {React.ChangeEvent<HTMLSelectElement>} e - The change event
   */
  const handlePresetPromptChange = (e) => {
    const selectedId = e.target.value;
    setSelectedPresetPrompt(selectedId);
    
    if (selectedId) {
      const selected = presetPrompts.find(p => p.id === selectedId);
      if (selected) {
        setAiPrompt(selected.prompt);
      }
    } else {
      setAiPrompt('');
    }
  };
  
  /**
   * Processes text with selected AI provider
   * Sends the text and prompt to the AI transformation API
   * 
   * @async
   */
  const processWithAI = async () => {
    if (!aiInput.trim()) {
      sessionActions.setError('Please enter text to process');
      return;
    }
    
    if (!aiPrompt.trim()) {
      sessionActions.setError('Please enter a prompt or select a preset');
      return;
    }
    
    try {
      sessionActions.setProcessing(true);
      
      // Call AI processing API
      const response = await fetch('/api/aiTransform', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: aiInput,
          prompt: aiPrompt,
          provider: aiProvider
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to process with AI');
      }
      
      const data = await response.json();
      setAiResult(data.result);
      
      if (data.result && data.result.trim()) {
        addNotification({
          type: 'success',
          message: 'AI processing completed',
        });
      } else {
        throw new Error('AI returned empty result');
      }
    } catch (error) {
      sessionActions.setError(`Error processing with AI: ${error.message}`);
    } finally {
      sessionActions.setProcessing(false);
    }
  };
  
  /**
   * Applies AI processed result to the main text input area
   * Sets the active tab to main and shows success notification
   */
  const applyAiResult = () => {
    if (!aiResult.trim()) {
      sessionActions.setError('No AI processed content to apply');
      return;
    }

    sessionActions.setInputText(aiResult);
    addNotification({
      type: 'success',
      message: 'AI processed content applied to input text',
    });
    sessionActions.setActiveTab('main');
  };
  
  return (
    <div className="space-y-8">
      {/* HTML/URL Parsing Tool */}
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <h3 className="text-lg font-medium mb-4">HTML/URL Parsing</h3>
        
        <div className="mb-4">
          <label 
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="html-input"
          >
            Enter a URL or paste HTML
          </label>
          <textarea
            id="html-input"
            value={htmlInput}
            onChange={(e) => setHtmlInput(e.target.value)}
            className="input-field h-32"
            placeholder="https://example.com or <html>...</html>"
            disabled={isProcessing}
          ></textarea>
        </div>
        
        <div className="mb-4">
          <button
            id="extract-text-btn"
            onClick={parseHtmlOrUrl}
            className="btn btn-primary w-full"
            disabled={isProcessing || !htmlInput.trim()}
          >
            Extract Text
          </button>
        </div>
        
        {parseResult && (
          <div>
            <div className="mb-4">
              <label 
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="parse-result"
              >
                Extracted Text
              </label>
              <textarea
                id="parse-result"
                value={parseResult}
                onChange={(e) => setParseResult(e.target.value)}
                className="input-field h-32"
                disabled={isProcessing}
              ></textarea>
            </div>
            
            <div className="flex justify-end">
              <button
                id="use-parsed-text-btn"
                onClick={applyParsedResult}
                className="btn btn-secondary"
                disabled={isProcessing}
              >
                Use This Text
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* AI Transformation Tool */}
      <div
        className="p-4 rounded-lg"
        style={{
          backgroundColor: 'var(--card-bg)',
          borderColor: 'var(--card-border)',
          borderWidth: '1px',
        }}
      >
        <h3 className="text-lg font-medium mb-4">AI Transformation</h3>
        
        <div className="mb-4">
          <label 
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="ai-input"
          >
            Text to Process
          </label>
          <textarea
            id="ai-input"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            className="input-field h-32"
            placeholder="Enter your text to be processed by AI..."
            disabled={isProcessing}
          ></textarea>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label 
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="preset-prompts-select"
            >
              Preset Prompts
            </label>
            <select
              id="preset-prompts-select"
              value={selectedPresetPrompt}
              onChange={handlePresetPromptChange}
              className="select-field"
              disabled={isProcessing}
            >
              <option value="">Select a preset prompt</option>
              {presetPrompts.map(prompt => (
                <option key={prompt.id} value={prompt.id}>
                  {prompt.label}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label 
              className="block text-sm font-medium text-gray-700 mb-1"
              htmlFor="ai-provider-select"
            >
              AI Provider
            </label>
            <select
              id="ai-provider-select"
              value={aiProvider}
              onChange={(e) => setAiProvider(e.target.value)}
              className="select-field"
              disabled={isProcessing}
            >
              <option value="openai">OpenAI (ChatGPT)</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>
        </div>
        
        <div className="mb-4">
          <label 
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="ai-prompt"
          >
            Prompt
          </label>
          <textarea
            id="ai-prompt"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="input-field h-24"
            placeholder="Enter instructions for the AI..."
            disabled={isProcessing}
          ></textarea>
        </div>
        
        <div className="mb-4">
          <button
            id="process-ai-btn"
            onClick={processWithAI}
            className="btn btn-primary w-full"
            disabled={isProcessing || !aiInput.trim() || !aiPrompt.trim()}
          >
            Process with AI
          </button>
        </div>
        
        {aiResult && (
          <div>
            <div className="mb-4">
              <label 
                className="block text-sm font-medium text-gray-700 mb-1"
                htmlFor="ai-result"
              >
                AI Result
              </label>
              <textarea
                id="ai-result"
                value={aiResult}
                onChange={(e) => setAiResult(e.target.value)}
                className="input-field h-32"
                disabled={isProcessing}
              ></textarea>
            </div>
            
            <div className="flex justify-end">
              <button
                id="use-ai-result-btn"
                onClick={applyAiResult}
                className="btn btn-secondary"
                disabled={isProcessing}
              >
                Use This Text
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolsTab;
