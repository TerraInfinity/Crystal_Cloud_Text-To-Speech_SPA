import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TemplatesTab from '../TemplatesTab';
import { useTTS } from '../../context/TTSContext';
import { useTTSSession } from '../../context/TTSSessionContext';

// Mock context hooks
jest.mock('../../context/TTSContext');
jest.mock('../../context/TTSSessionContext');

// Mock console.log for debugging
console.log = jest.fn();

describe('TemplatesTab', () => {
  const mockTTSState = {
    templates: {
      'template-1': {
        id: 'template-1',
        name: 'Test Template',
        description: 'Test Description',
        sections: [
          {
            id: 'section-1',
            title: 'Section 1',
            type: 'text-to-speech',
            text: 'Sample text',
            voice: { engine: 'gtts', id: 'us', name: 'American English', language: 'en', tld: 'com' },
            voiceSettings: { pitch: 1, rate: 1, volume: 1 },
          },
        ],
      },
    },
    AudioLibrary: {
      'audio-1': { id: 'audio-1', name: 'Test Audio', url: 'http://example.com/audio.mp3' },
    },
    settings: {
      activeVoices: {
        gtts: [
          { engine: 'gtts', id: 'us', name: 'American English', language: 'en', tld: 'com' },
          { engine: 'gtts', id: 'uk', name: 'British English', language: 'en', tld: 'co.uk' },
        ],
      },
      defaultVoices: {
        gtts: [{ engine: 'gtts', id: 'us', name: 'American English', language: 'en', tld: 'com' }],
      },
    },
  };

  const mockTTSActions = {
    saveTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
  };

  const mockSessionState = {
    templateCreation: {
      templateName: '',
      templateDescription: '',
      sections: [],
      editingTemplate: null,
    },
  };

  const mockSessionActions = {
    addTemplateCreationSection: jest.fn(),
    updateTemplateCreationSection: jest.fn(),
    removeTemplateCreationSection: jest.fn(),
    moveTemplateCreationSectionUp: jest.fn(),
    moveTemplateCreationSectionDown: jest.fn(),
    setTemplateName: jest.fn(),
    setTemplateDescription: jest.fn(),
    setTemplateCreationSections: jest.fn(),
    setEditingTemplate: jest.fn(),
    clearTemplateCreationForm: jest.fn(),
    setNotification: jest.fn(),
    setError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useTTS as jest.Mock).mockReturnValue({
      state: mockTTSState,
      actions: mockTTSActions,
    });
    (useTTSSession as jest.Mock).mockReturnValue({
      state: mockSessionState,
      actions: mockSessionActions,
    });

    // Create a spy on clearTemplateCreationForm after it's been overridden by the component
    jest.spyOn(mockSessionActions, 'clearTemplateCreationForm');
  });

  test('renders template creation form', () => {
    render(<TemplatesTab />);
    expect(screen.getByText('Create New Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Description (optional)')).toBeInTheDocument();
    expect(screen.getByText('Sections')).toBeInTheDocument();
  });

  test('renders saved templates', () => {
    render(<TemplatesTab />);
    expect(screen.getByText('Saved Templates')).toBeInTheDocument();
    expect(screen.getByText('Test Template - Test Description')).toBeInTheDocument();
  });

  test('adds a new section', () => {
    render(<TemplatesTab />);
    const addButton = screen.getByTitle('Add Section');
    fireEvent.click(addButton);

    expect(mockSessionActions.addTemplateCreationSection).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^section-\d+$/),
      title: 'Section 1',
      type: 'text-to-speech',
      text: '',
      voice: null,
      voiceSettings: { pitch: 1, rate: 1, volume: 1 },
    }));
  });

  test('updates section title', () => {
    (useTTSSession as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        templateCreation: {
          ...mockSessionState.templateCreation,
          sections: [
            {
              id: 'section-1',
              title: 'Section 1',
              type: 'text-to-speech',
              text: '',
              voice: null,
              voiceSettings: { pitch: 1, rate: 1, volume: 1 },
            },
          ],
        },
      },
      actions: mockSessionActions,
    });

    render(<TemplatesTab />);
    const titleInput = screen.getByPlaceholderText('Section title');
    fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

    expect(mockSessionActions.updateTemplateCreationSection).toHaveBeenCalledWith(0, { title: 'Updated Title' });
  });

  test('removes a section', () => {
    (useTTSSession as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        templateCreation: {
          ...mockSessionState.templateCreation,
          sections: [
            { id: 'section-1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null, voiceSettings: { pitch: 1, rate: 1, volume: 1 } },
            { id: 'section-2', title: 'Section 2', type: 'audio-only', audioId: null },
          ],
        },
      },
      actions: mockSessionActions,
    });

    render(<TemplatesTab />);
    const removeButton = screen.getAllByTitle('Remove Section')[0];
    fireEvent.click(removeButton);

    expect(mockSessionActions.removeTemplateCreationSection).toHaveBeenCalledWith(0);
  });

  test('prevents removing last section', () => {
    (useTTSSession as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        templateCreation: {
          ...mockSessionState.templateCreation,
          sections: [
            { id: 'section-1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null, voiceSettings: { pitch: 1, rate: 1, volume: 1 } },
          ],
        },
      },
      actions: mockSessionActions,
    });

    render(<TemplatesTab />);
    const removeButton = screen.getByTitle('Remove Section');
    fireEvent.click(removeButton);

    expect(mockSessionActions.removeTemplateCreationSection).not.toHaveBeenCalled();
    expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
      type: 'warning',
      message: 'At least one section is required!',
    });
  });

  test('moves section up', () => {
    (useTTSSession as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        templateCreation: {
          ...mockSessionState.templateCreation,
          sections: [
            { id: 'section-1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null, voiceSettings: { pitch: 1, rate: 1, volume: 1 } },
            { id: 'section-2', title: 'Section 2', type: 'audio-only', audioId: null },
          ],
        },
      },
      actions: mockSessionActions,
    });

    render(<TemplatesTab />);
    const moveUpButton = screen.getAllByTitle('Move Up')[1];
    fireEvent.click(moveUpButton);

    expect(mockSessionActions.moveTemplateCreationSectionUp).toHaveBeenCalledWith(1);
  });

  test('moves section down', () => {
    (useTTSSession as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        templateCreation: {
          ...mockSessionState.templateCreation,
          sections: [
            { id: 'section-1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null, voiceSettings: { pitch: 1, rate: 1, volume: 1 } },
            { id: 'section-2', title: 'Section 2', type: 'audio-only', audioId: null },
          ],
        },
      },
      actions: mockSessionActions,
    });

    render(<TemplatesTab />);
    const moveDownButton = screen.getAllByTitle('Move Down')[0];
    fireEvent.click(moveDownButton);

    expect(mockSessionActions.moveTemplateCreationSectionDown).toHaveBeenCalledWith(0);
  });

  test('saves template with valid name', () => {
    (useTTSSession as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        templateCreation: {
          ...mockSessionState.templateCreation,
          templateName: 'New Template',
          sections: [
            { id: 'section-1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null, voiceSettings: { pitch: 1, rate: 1, volume: 1 } },
          ],
        },
      },
      actions: mockSessionActions,
    });

    render(<TemplatesTab />);
    const saveButton = screen.getByTitle('Save Template');
    fireEvent.click(saveButton);

    expect(mockTTSActions.saveTemplate).toHaveBeenCalledWith(expect.objectContaining({
      id: expect.stringMatching(/^template-\d+$/),
      name: 'New Template',
      sections: expect.any(Array),
    }));
    expect(mockSessionActions.clearTemplateCreationForm).toHaveBeenCalled();
    expect(mockSessionActions.setNotification).toHaveBeenCalledWith({
      type: 'success',
      message: 'Template saved successfully!',
    });
  });

  test('prevents saving template without name', () => {
    render(<TemplatesTab />);
    const saveButton = screen.getByTitle('Save Template');
    fireEvent.click(saveButton);

    expect(mockTTSActions.saveTemplate).not.toHaveBeenCalled();
    expect(mockSessionActions.setError).toHaveBeenCalledWith('Please enter a template name');
  });

  test('edits existing template', () => {
    render(<TemplatesTab />);
    const editButton = screen.getByTitle('Edit Template');
    fireEvent.click(editButton);

    expect(mockSessionActions.setEditingTemplate).toHaveBeenCalledWith(mockTTSState.templates['template-1']);
    expect(mockSessionActions.setTemplateName).toHaveBeenCalledWith('Test Template');
    expect(mockSessionActions.setTemplateDescription).toHaveBeenCalledWith('Test Description');
    expect(mockSessionActions.setTemplateCreationSections).toHaveBeenCalledWith(mockTTSState.templates['template-1'].sections);
  });

  test('deletes template', () => {
    render(<TemplatesTab />);
    const deleteButton = screen.getByTitle('Delete Template');
    fireEvent.click(deleteButton);

    expect(mockTTSActions.deleteTemplate).toHaveBeenCalledWith('template-1');
    // We don't check clearTemplateCreationForm here because it's conditionally called only if the 
    // template being deleted is currently being edited, which isn't the case in this test setup
  });

  test('selects voice for text-to-speech section', () => {
    (useTTSSession as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        templateCreation: {
          ...mockSessionState.templateCreation,
          sections: [
            { id: 'section-1', title: 'Section 1', type: 'text-to-speech', text: '', voice: null, voiceSettings: { pitch: 1, rate: 1, volume: 1 } },
          ],
        },
      },
      actions: mockSessionActions,
    });

    render(<TemplatesTab />);
    
    // Use the queryByTestId to find the element by ID instead of label
    const voiceSelect = screen.getByTestId('section-voice-section-1') || screen.getByRole('combobox');
    
    fireEvent.change(voiceSelect, { target: { value: 'gtts-uk' } });

    expect(mockSessionActions.updateTemplateCreationSection).toHaveBeenCalledWith(0, {
      voice: expect.objectContaining({ id: 'uk', engine: 'gtts' }),
    });
  });

  test('selects audio for audio-only section', () => {
    (useTTSSession as jest.Mock).mockReturnValue({
      state: {
        ...mockSessionState,
        templateCreation: {
          ...mockSessionState.templateCreation,
          sections: [
            { id: 'section-1', title: 'Section 1', type: 'audio-only', audioId: null },
          ],
        },
      },
      actions: mockSessionActions,
    });

    render(<TemplatesTab />);
    
    // Use the queryByTestId to find the element by ID instead of label
    const audioSelect = screen.getByTestId('section-audio-section-1') || screen.getByRole('combobox');
    
    fireEvent.change(audioSelect, { target: { value: 'audio-1' } });

    expect(mockSessionActions.updateTemplateCreationSection).toHaveBeenCalledWith(0, { audioId: 'audio-1' });
  });

  test('clears template creation form', () => {
    render(<TemplatesTab />);
    const startOverButton = screen.getByTitle('Start Over');
    fireEvent.click(startOverButton);

    expect(mockSessionActions.clearTemplateCreationForm).toHaveBeenCalled();
  });
});