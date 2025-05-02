// utils/__tests__/textUtils.test.ts

import { parseTextFromHtml, extractSections, processVoiceTags } from '../textUtils';

// Mock DOMParser for browser environment
const mockDOMParser = {
  parseFromString: jest.fn(),
};
global.DOMParser = jest.fn(() => mockDOMParser);

// Mock document for DOM manipulation
const mockDocument = {
  querySelectorAll: jest.fn(),
  body: { textContent: '' },
};
const mockElements = [{ remove: jest.fn() }];

describe('textUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDOMParser.parseFromString.mockReset();
    mockDocument.querySelectorAll.mockReset();
    mockDocument.body.textContent = '';
  });

  describe('parseTextFromHtml', () => {
    test('parses HTML in browser environment', () => {
      global.window = { document: {} } as any;
      mockDOMParser.parseFromString.mockReturnValue(mockDocument);
      mockDocument.querySelectorAll.mockReturnValue(mockElements);
      mockDocument.body.textContent = 'Hello world';

      const result = parseTextFromHtml('<p>Hello world</p><script>alert("test")</script>');

      expect(DOMParser).toHaveBeenCalled();
      expect(mockDOMParser.parseFromString).toHaveBeenCalledWith('<p>Hello world</p><script>alert("test")</script>', 'text/html');
      expect(mockDocument.querySelectorAll).toHaveBeenCalledWith('script, style, noscript, iframe, object, embed');
      expect(mockElements[0].remove).toHaveBeenCalled();
      expect(result).toBe('Hello world');
    });

    test('parses HTML in server environment', () => {
      delete (global as any).window;

      const html = `
        <p>Hello world</p>
        <script>alert("test")</script>
        <style>.class { color: red; }</style>
        <div>Another &lt;test&gt;</div>
      `;
      const result = parseTextFromHtml(html);

      expect(result).toBe('Hello world Another <test>');
    });

    test('handles HTML entities and whitespace', () => {
      delete (global as any).window;

      const html = '<p>Hello&nbsp;world<br>  Test &amp; More</p>';
      const result = parseTextFromHtml(html);

      expect(result).toBe('Hello world Test & More');
    });

    test('returns empty string for empty HTML', () => {
      global.window = { document: {} } as any;
      mockDOMParser.parseFromString.mockReturnValue(mockDocument);
      mockDocument.querySelectorAll.mockReturnValue([]);
      mockDocument.body.textContent = '';

      const result = parseTextFromHtml('');

      expect(result).toBe('');
    });
  });

  describe('extractSections', () => {
    test('extracts sections based on markers', () => {
      const text = `
        [Intro]
        Welcome to the show
        Line two
        [Body]
        Main content
        More content
        [Outro]
        Goodbye
      `;
      const sectionMarkers = ['Intro', 'Body', 'Outro'];

      const result = extractSections(text, sectionMarkers);

      expect(result).toEqual({
        Intro: 'Welcome to the show\nLine two',
        Body: 'Main content\nMore content',
        Outro: 'Goodbye'
      });
    });

    test('handles case-insensitive markers', () => {
      const text = `
        [intro]
        Intro text
        [BODY]
        Body text
      `;
      const sectionMarkers = ['Intro', 'Body'];

      const result = extractSections(text, sectionMarkers);

      expect(result).toEqual({
        Intro: 'Intro text',
        Body: 'Body text'
      });
    });

    test('returns empty sections if no content after markers', () => {
      const text = `
        [Intro]
        [Body]
        [Outro]
      `;
      const sectionMarkers = ['Intro', 'Body', 'Outro'];

      const result = extractSections(text, sectionMarkers);

      expect(result).toEqual({
        Intro: '',
        Body: '',
        Outro: ''
      });
    });

    test('handles missing markers', () => {
      const text = `
        [Intro]
        Intro text
        [Outro]
        Outro text
      `;
      const sectionMarkers = ['Intro', 'Body', 'Outro'];

      const result = extractSections(text, sectionMarkers);

      expect(result).toEqual({
        Intro: 'Intro text',
        Body: '',
        Outro: 'Outro text'
      });
    });

    test('returns empty object for empty text', () => {
      const result = extractSections('', ['Intro', 'Body']);

      expect(result).toEqual({
        Intro: '',
        Body: '',
      });
    });
  });

  describe('processVoiceTags', () => {
    test('processes voice and sound tags', () => {
      const text = `
        [voice:Alice]Hello [sound:beep]world
        [voice:Bob]Test [sound:chime]content
      `;

      const result = processVoiceTags(text);

      const expectedText = result.text;
      
      expect(result.voiceSettings).toEqual([
        { voice: 'Alice', start: result.voiceSettings[0].start, end: result.voiceSettings[0].end },
        { voice: 'Bob', start: result.voiceSettings[1].start, end: result.voiceSettings[1].end }
      ]);
      
      expect(result.voiceSettings[0].start).toBeGreaterThanOrEqual(0);
      expect(result.voiceSettings[0].end).toBeGreaterThan(result.voiceSettings[0].start);
      expect(result.voiceSettings[1].start).toBeGreaterThanOrEqual(0);
      expect(result.voiceSettings[1].end).toBeGreaterThan(result.voiceSettings[1].start);
    });

    test('handles only sound tags', () => {
      const text = 'Hello [sound:beep]world';

      const result = processVoiceTags(text);

      expect(result.voiceSettings).toEqual([]);
      expect(result.text).toMatch(/Hello.*world/);
    });

    test('handles only voice tags', () => {
      const text = '[voice:Alice]Hello world';

      const result = processVoiceTags(text);

      expect(result.text).toBe('Hello world');
      expect(result.voiceSettings.length).toBe(1);
      expect(result.voiceSettings[0].voice).toBe('Alice');
      expect(typeof result.voiceSettings[0].start).toBe('number');
      expect(typeof result.voiceSettings[0].end).toBe('number');
    });

    test('handles empty text', () => {
      const result = processVoiceTags('');

      expect(result).toEqual({
        text: '',
        voiceSettings: [],
      });
    });

    test('handles multiple tags in sequence', () => {
      const text = '[voice:Alice][voice:Bob]Text [sound:beep][sound:chime]here';

      const result = processVoiceTags(text);

      expect(result.text).toMatch(/Text.*here/);
      expect(result.voiceSettings.length).toBe(2);
      expect(result.voiceSettings[0].voice).toBe('Alice');
      expect(result.voiceSettings[1].voice).toBe('Bob');
    });
  });
});