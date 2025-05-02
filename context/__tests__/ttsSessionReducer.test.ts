import { ttsSessionReducer } from '../ttsSessionReducer';
import { initialSessionState } from '../ttsDefaults';
import { devLog } from '../../utils/logUtils';

// Mock logUtils
jest.mock('../../utils/logUtils', () => ({
  devLog: jest.fn(),
}));

// Define state type based on initialSessionState
interface SessionState {
  inputText: string;
  inputType: string;
  currentTemplate: string;
  sections: any[];
  activeTab: string;
  isProcessing: boolean;
  errorMessage: string | null;
  notification: string | null;
  mergedAudio: string | null;
  isPlaying: boolean;
  selectedAudioLibraryId: string | null;
  generatedTTSAudios: Record<string, any>;
  selectedInputVoice: any;
  templateCreation: {
    templateName: string;
    templateDescription: string;
    sections: any[];
    editingTemplate: any;
  };
}

describe('ttsSessionReducer', () => {
  let state: SessionState;

  beforeEach(() => {
    jest.clearAllMocks();
    state = { ...initialSessionState };
  });

  test('SET_INPUT_TEXT updates inputText', () => {
    const action = { type: 'SET_INPUT_TEXT', payload: 'Hello' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.inputText).toBe('Hello');
    expect(newState).not.toBe(state);
  });

  test('SET_SELECTED_INPUT_VOICE updates selectedInputVoice', () => {
    const voice = { id: 'en-com', name: 'American English' };
    const action = { type: 'SET_SELECTED_INPUT_VOICE', payload: voice };
    const newState = ttsSessionReducer(state, action);
    expect(newState.selectedInputVoice).toBe(voice);
  });

  test('SET_INPUT_TYPE updates inputType', () => {
    const action = { type: 'SET_INPUT_TYPE', payload: 'audio' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.inputType).toBe('audio');
  });

  test('SET_TEMPLATE updates currentTemplate', () => {
    const action = { type: 'SET_TEMPLATE', payload: 'yogaKriya' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.currentTemplate).toBe('yogaKriya');
  });

  test('SET_SECTIONS updates sections with normalization', () => {
    const sections = [{ id: '1', title: 'Test', type: 'text-to-speech' }];
    const action = { type: 'SET_SECTIONS', payload: sections };
    const newState = ttsSessionReducer(state, action);
    expect(newState.sections).toEqual([
      expect.objectContaining({
        id: '1',
        title: 'Test',
        type: 'text-to-speech',
        text: '',
      }),
    ]);
    expect(newState.sections[0]).toHaveProperty('voice');
    expect(newState.sections[0]).toHaveProperty('voiceSettings');
  });

  test('ADD_SECTION adds a normalized section', () => {
    const section = { id: '1', title: 'New Section', type: 'text-to-speech' };
    const action = { type: 'ADD_SECTION', payload: section };
    const newState = ttsSessionReducer(state, action);
    expect(newState.sections).toHaveLength(1);
    expect(newState.sections[0]).toEqual(
      expect.objectContaining({
        id: '1',
        title: 'New Section',
        type: 'text-to-speech',
        text: '',
      })
    );
    expect(newState.sections[0]).toHaveProperty('voice');
    expect(newState.sections[0]).toHaveProperty('voiceSettings');
  });

  test('UPDATE_SECTION updates a section', () => {
    state.sections = [{ id: '1', title: 'Old', type: 'text-to-speech', text: '', voice: null }];
    const action = { type: 'UPDATE_SECTION', payload: { id: '1', title: 'New', type: 'text-to-speech' } };
    const newState = ttsSessionReducer(state, action);
    expect(newState.sections[0]).toEqual(
      expect.objectContaining({
        id: '1',
        title: 'New',
        type: 'text-to-speech',
        text: '',
      })
    );
    expect(newState.sections[0]).toHaveProperty('voice');
    expect(newState.sections[0]).toHaveProperty('voiceSettings');
    expect(devLog).toHaveBeenCalledWith('Updating section with payload:', { id: '1', title: 'New', type: 'text-to-speech' });
  });

  test('REMOVE_SECTION removes a section', () => {
    state.sections = [{ id: '1', title: 'Test', type: 'text-to-speech', text: '', voice: null }];
    const action = { type: 'REMOVE_SECTION', payload: '1' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.sections).toHaveLength(0);
  });

  test('REORDER_SECTIONS updates sections order', () => {
    state.sections = [
      { id: '1', title: 'First', type: 'text-to-speech', text: '', voice: null },
      { id: '2', title: 'Second', type: 'text-to-speech', text: '', voice: null },
    ];
    const action = { type: 'REORDER_SECTIONS', payload: [state.sections[1], state.sections[0]] };
    const newState = ttsSessionReducer(state, action);
    expect(newState.sections[0].id).toBe('2');
    expect(newState.sections[1].id).toBe('1');
  });

  test('SET_ACTIVE_TAB updates activeTab', () => {
    const action = { type: 'SET_ACTIVE_TAB', payload: 'settings' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.activeTab).toBe('settings');
  });

  test('SET_PROCESSING updates isProcessing', () => {
    const action = { type: 'SET_PROCESSING', payload: true };
    const newState = ttsSessionReducer(state, action);
    expect(newState.isProcessing).toBe(true);
  });

  test('SET_ERROR updates errorMessage', () => {
    const action = { type: 'SET_ERROR', payload: 'Error' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.errorMessage).toBe('Error');
  });

  test('SET_NOTIFICATION updates notification', () => {
    const action = { type: 'SET_NOTIFICATION', payload: 'Success' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.notification).toBe('Success');
  });

  test('SET_GENERATED_AUDIO updates generatedTTSAudios', () => {
    const action = { type: 'SET_GENERATED_AUDIO', payload: { sectionId: '1', audioData: { url: 'audio.mp3' } } };
    const newState = ttsSessionReducer(state, action);
    expect(newState.generatedTTSAudios['1']).toEqual({ url: 'audio.mp3' });
  });

  test('SET_MERGED_AUDIO updates mergedAudio', () => {
    const action = { type: 'SET_MERGED_AUDIO', payload: 'merged.mp3' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.mergedAudio).toBe('merged.mp3');
  });

  test('SET_PLAYING updates isPlaying', () => {
    const action = { type: 'SET_PLAYING', payload: true };
    const newState = ttsSessionReducer(state, action);
    expect(newState.isPlaying).toBe(true);
  });

  test('SET_SELECTED_AUDIO updates selectedAudioLibraryId', () => {
    const action = { type: 'SET_SELECTED_AUDIO', payload: 'audio-1' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.selectedAudioLibraryId).toBe('audio-1');
  });

  test('SET_SECTION_VOICE updates section voice', () => {
    state.sections = [{ id: '1', title: 'Test', type: 'text-to-speech', text: '', voice: null }];
    const voice = { id: 'en-com', name: 'American English' };
    const action = { type: 'SET_SECTION_VOICE', payload: { sectionId: '1', voice } };
    const newState = ttsSessionReducer(state, action);
    expect(newState.sections[0].voice).toBe(voice);
    expect(devLog).toHaveBeenCalledWith('Setting voice for section:', '1', 'Voice:', voice);
  });

  test('SET_VOICE_SETTINGS updates section voiceSettings', () => {
    state.sections = [{ id: '1', title: 'Test', type: 'text-to-speech', text: '', voice: null, voiceSettings: null }];
    const settings = { volume: 0.8, rate: 1.2, pitch: 1 };
    const action = { type: 'SET_VOICE_SETTINGS', payload: { sectionId: '1', settings } };
    const newState = ttsSessionReducer(state, action);
    expect(newState.sections[0].voiceSettings).toBe(settings);
    expect(devLog).toHaveBeenCalledWith('Setting voice settings for section:', '1', 'Settings:', settings);
  });

  test('LOAD_SESSION_STATE merges state with normalization', () => {
    const savedState = {
      ...initialSessionState,
      inputText: 'Test',
      sections: [{ id: '1', title: 'Saved Section', type: 'text-to-speech' }],
    };
    const action = { type: 'LOAD_SESSION_STATE', payload: savedState };
    const newState = ttsSessionReducer(state, action);
    expect(newState.inputText).toBe('Test');
    expect(newState.sections[0]).toEqual(
      expect.objectContaining({
        id: '1',
        title: 'Saved Section',
        type: 'text-to-speech',
        text: '',
      })
    );
    expect(newState.sections[0]).toHaveProperty('voice');
    expect(newState.sections[0]).toHaveProperty('voiceSettings');
  });

  test('SET_TEMPLATE_NAME updates templateCreation.templateName', () => {
    const action = { type: 'SET_TEMPLATE_NAME', payload: 'New Template' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.templateName).toBe('New Template');
  });

  test('SET_TEMPLATE_DESCRIPTION updates templateCreation.templateDescription', () => {
    const action = { type: 'SET_TEMPLATE_DESCRIPTION', payload: 'Description' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.templateDescription).toBe('Description');
  });

  test('SET_TEMPLATE_CREATION_SECTIONS updates templateCreation.sections', () => {
    const sections = [{ id: '1', title: 'Section 1', type: 'text-to-speech' }];
    const action = { type: 'SET_TEMPLATE_CREATION_SECTIONS', payload: sections };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.sections).toEqual([
      expect.objectContaining({
        id: '1',
        title: 'Section 1',
        type: 'text-to-speech',
        text: '',
      }),
    ]);
    expect(newState.templateCreation.sections[0]).toHaveProperty('voice');
    expect(newState.templateCreation.sections[0]).toHaveProperty('voiceSettings');
  });

  test('ADD_TEMPLATE_CREATION_SECTION adds a section', () => {
    const section = { id: '2', title: 'New Section' };
    const action = { type: 'ADD_TEMPLATE_CREATION_SECTION', payload: section };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.sections).toHaveLength(2);
    expect(newState.templateCreation.sections[1]).toEqual(
      expect.objectContaining({
        id: '2',
        title: 'New Section',
        type: 'text-to-speech',
      })
    );
  });

  test('UPDATE_TEMPLATE_CREATION_SECTION updates a section', () => {
    const action = { type: 'UPDATE_TEMPLATE_CREATION_SECTION', payload: { index: 0, updates: { title: 'Updated' } } };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.sections[0].title).toBe('Updated');
  });

  test('REMOVE_TEMPLATE_CREATION_SECTION removes a section', () => {
    state.templateCreation.sections = [
      { id: '1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null },
      { id: '2', title: 'Section 2', type: 'text-to-speech', text: '', voice: null },
    ];
    const action = { type: 'REMOVE_TEMPLATE_CREATION_SECTION', payload: 1 };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.sections).toHaveLength(1);
    expect(newState.templateCreation.sections[0].id).toBe('1');
  });

  test('REMOVE_TEMPLATE_CREATION_SECTION does not remove last section', () => {
    const action = { type: 'REMOVE_TEMPLATE_CREATION_SECTION', payload: 0 };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.sections).toHaveLength(1);
  });

  test('MOVE_TEMPLATE_CREATION_SECTION_UP swaps sections', () => {
    state.templateCreation.sections = [
      { id: '1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null },
      { id: '2', title: 'Section 2', type: 'text-to-speech', text: '', voice: null },
    ];
    const action = { type: 'MOVE_TEMPLATE_CREATION_SECTION_UP', payload: 1 };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.sections[0].id).toBe('2');
    expect(newState.templateCreation.sections[1].id).toBe('1');
  });

  test('MOVE_TEMPLATE_CREATION_SECTION_DOWN swaps sections', () => {
    state.templateCreation.sections = [
      { id: '1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null },
      { id: '2', title: 'Section 2', type: 'text-to-speech', text: '', voice: null },
    ];
    const action = { type: 'MOVE_TEMPLATE_CREATION_SECTION_DOWN', payload: 0 };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.sections[0].id).toBe('2');
    expect(newState.templateCreation.sections[1].id).toBe('1');
  });

  test('SET_EDITING_TEMPLATE updates editingTemplate', () => {
    const template = { id: 'template-1', name: 'Test Template' };
    const action = { type: 'SET_EDITING_TEMPLATE', payload: template };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation.editingTemplate).toBe(template);
  });

  test('CLEAR_TEMPLATE_CREATION_FORM resets templateCreation', () => {
    state.templateCreation = {
      templateName: 'Old Name',
      templateDescription: 'Old Desc',
      sections: [],
      editingTemplate: { id: 'old' },
    };
    const action = { type: 'CLEAR_TEMPLATE_CREATION_FORM' };
    const newState = ttsSessionReducer(state, action);
    expect(newState.templateCreation).toEqual(
      expect.objectContaining({
        templateName: '',
        templateDescription: '',
        sections: expect.arrayContaining([expect.any(Object)]),
        editingTemplate: null,
      })
    );
  });

  test('handles unknown action by returning current state', () => {
    const action = { type: 'UNKNOWN_ACTION', payload: 'test' };
    const newState = ttsSessionReducer(state, action);
    expect(newState).toBe(state);
    expect(devLog).toHaveBeenCalledWith('Unhandled action type in ttsSessionReducer:', 'UNKNOWN_ACTION', 'Payload:', 'test');
  });
});