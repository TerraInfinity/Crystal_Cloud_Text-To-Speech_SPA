import { createSessionActions } from '../ttsSessionActions';
import { devLog } from '../../utils/logUtils';

// Mock logUtils
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

describe('ttsSessionActions', () => {
  const mockDispatch = jest.fn();
  const mockLoadDemoContent = jest.fn();
  let actions: ReturnType<typeof createSessionActions>;

  beforeEach(() => {
    jest.clearAllMocks();
    actions = createSessionActions(mockDispatch, mockLoadDemoContent);
  });

  test('setInputText dispatches correct action', () => {
    actions.setInputText('Hello');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_INPUT_TEXT',
      payload: 'Hello',
    });
  });

  test('setSelectedInputVoice dispatches correct action', () => {
    const voice = { id: 'en-com', name: 'American English' };
    actions.setSelectedInputVoice(voice);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SELECTED_INPUT_VOICE',
      payload: voice,
    });
  });

  test('setInputType dispatches correct action', () => {
    actions.setInputType('audio');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_INPUT_TYPE',
      payload: 'audio',
    });
  });

  test('setTemplate dispatches correct action', () => {
    actions.setTemplate('yogaKriya');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_TEMPLATE',
      payload: 'yogaKriya',
    });
  });

  test('setSections dispatches correct action', () => {
    const sections = [{ id: '1', title: 'Test Section' }];
    actions.setSections(sections);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SECTIONS',
      payload: sections,
    });
  });

  test('addSection dispatches correct action', () => {
    const section = { id: '1', title: 'New Section' };
    actions.addSection(section);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ADD_SECTION',
      payload: section,
    });
  });

  test('updateSection dispatches correct action', () => {
    const section = { id: '1', title: 'Updated Section' };
    actions.updateSection(section);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SECTION',
      payload: section,
    });
  });

  test('removeSection dispatches correct action', () => {
    actions.removeSection('1');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REMOVE_SECTION',
      payload: '1',
    });
  });

  test('reorderSections dispatches correct action', () => {
    const sections = [{ id: '1' }, { id: '2' }];
    actions.reorderSections(sections);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REORDER_SECTIONS',
      payload: sections,
    });
  });

  test('setActiveTab dispatches correct action', () => {
    actions.setActiveTab('settings');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_ACTIVE_TAB',
      payload: 'settings',
    });
  });

  test('setProcessing dispatches correct action', () => {
    actions.setProcessing(true);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_PROCESSING',
      payload: true,
    });
  });

  test('setError dispatches correct action', () => {
    actions.setError('Error message');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_ERROR',
      payload: 'Error message',
    });
  });

  test('setNotification dispatches correct action', () => {
    actions.setNotification('Success');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_NOTIFICATION',
      payload: 'Success',
    });
  });

  test('setGeneratedAudio dispatches correct action with valid audioData', () => {
    const audioData = { url: 'http://example.com/audio.mp3' };
    actions.setGeneratedAudio('section-1', audioData);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_GENERATED_AUDIO',
      payload: { sectionId: 'section-1', audioData },
    });
    expect(devLog).toHaveBeenCalledWith('Set generated audio for section section-1:', audioData);
  });

  test('setGeneratedAudio does not dispatch with invalid audioData', () => {
    actions.setGeneratedAudio('section-1', null);
    expect(mockDispatch).not.toHaveBeenCalled();
    expect(devLog).toHaveBeenCalledWith('Invalid audio data for setGeneratedAudio:', {
      sectionId: 'section-1',
      audioData: null,
    });
  });

  test('setMergedAudio dispatches correct action', () => {
    actions.setMergedAudio('http://example.com/merged.mp3');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_MERGED_AUDIO',
      payload: 'http://example.com/merged.mp3',
    });
  });

  test('setPlaying dispatches correct action', () => {
    actions.setPlaying(true);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_PLAYING',
      payload: true,
    });
  });

  test('setSelectedAudio dispatches correct action', () => {
    actions.setSelectedAudio('audio-1');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SELECTED_AUDIO',
      payload: 'audio-1',
    });
  });

  test('setSectionVoice dispatches correct action', () => {
    const voice = { id: 'en-com', name: 'American English' };
    actions.setSectionVoice('section-1', voice);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_SECTION_VOICE',
      payload: { sectionId: 'section-1', voice },
    });
    expect(devLog).toHaveBeenCalledWith('Set voice for section section-1:', voice);
  });

  test('setVoiceSettings dispatches correct action', () => {
    const settings = { volume: 0.8, rate: 1.2, pitch: 1 };
    actions.setVoiceSettings('section-1', settings);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_VOICE_SETTINGS',
      payload: { sectionId: 'section-1', settings },
    });
    expect(devLog).toHaveBeenCalledWith('Set voice settings for section section-1:', settings);
  });

  test('loadDemoContent calls loadDemoContent with dispatch', () => {
    actions.loadDemoContent();
    expect(mockLoadDemoContent).toHaveBeenCalledWith(mockDispatch);
  });

  test('setTemplateName dispatches correct action', () => {
    actions.setTemplateName('New Template');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_TEMPLATE_NAME',
      payload: 'New Template',
    });
  });

  test('setTemplateDescription dispatches correct action', () => {
    actions.setTemplateDescription('Template description');
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_TEMPLATE_DESCRIPTION',
      payload: 'Template description',
    });
  });

  test('setTemplateCreationSections dispatches correct action', () => {
    const sections = [{ id: '1', title: 'Section 1' }];
    actions.setTemplateCreationSections(sections);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_TEMPLATE_CREATION_SECTIONS',
      payload: sections,
    });
  });

  test('addTemplateCreationSection dispatches correct action', () => {
    const section = { id: '1', title: 'New Section' };
    actions.addTemplateCreationSection(section);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ADD_TEMPLATE_CREATION_SECTION',
      payload: section,
    });
  });

  test('updateTemplateCreationSection dispatches correct action', () => {
    const updates = { title: 'Updated Section' };
    actions.updateTemplateCreationSection(0, updates);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_TEMPLATE_CREATION_SECTION',
      payload: { index: 0, updates },
    });
  });

  test('removeTemplateCreationSection dispatches correct action', () => {
    actions.removeTemplateCreationSection(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REMOVE_TEMPLATE_CREATION_SECTION',
      payload: 1,
    });
  });

  test('moveTemplateCreationSectionUp dispatches correct action', () => {
    actions.moveTemplateCreationSectionUp(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'MOVE_TEMPLATE_CREATION_SECTION_UP',
      payload: 1,
    });
  });

  test('moveTemplateCreationSectionDown dispatches correct action', () => {
    actions.moveTemplateCreationSectionDown(0);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'MOVE_TEMPLATE_CREATION_SECTION_DOWN',
      payload: 0,
    });
  });

  test('setEditingTemplate dispatches correct action', () => {
    const template = { id: 'template-1', name: 'Test Template' };
    actions.setEditingTemplate(template);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SET_EDITING_TEMPLATE',
      payload: template,
    });
  });

  test('clearTemplateCreationForm dispatches correct action', () => {
    actions.clearTemplateCreationForm();
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'CLEAR_TEMPLATE_CREATION_FORM',
    });
  });
});