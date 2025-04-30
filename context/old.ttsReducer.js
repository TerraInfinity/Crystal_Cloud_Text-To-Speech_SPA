// ttsReducer.js
import { initialState } from './ttsDefaults';
import { removeFromStorage } from './storage';
import { devLog } from '../utils/logUtils'; // Added import for development logging

export function ttsReducer(state, action) {
    switch (action.type) {
        case 'SET_THEME':
            devLog('Processing SET_THEME with payload:', action.payload);
            const newThemeState = {...state, theme: action.payload };
            devLog('New state after SET_THEME:', newThemeState);
            return newThemeState;
        case 'SET_INPUT_TEXT':
            devLog('Processing SET_INPUT_TEXT with payload:', action.payload);
            const newInputTextState = {...state, inputText: action.payload };
            devLog('New state after SET_INPUT_TEXT:', newInputTextState);
            return newInputTextState;
        case 'SET_INPUT_TYPE':
            devLog('Processing SET_INPUT_TYPE with payload:', action.payload);
            const newInputTypeState = {...state, inputType: action.payload };
            devLog('New state after SET_INPUT_TYPE:', newInputTypeState);
            return newInputTypeState;
        case 'SET_TEMPLATE':
            devLog('Processing SET_TEMPLATE with payload:', action.payload);
            const newTemplateState = {...state, currentTemplate: action.payload };
            devLog('New state after SET_TEMPLATE:', newTemplateState);
            return newTemplateState;
        case 'SET_SECTIONS':
            devLog('Processing SET_SECTIONS with payload:', action.payload);
            const newSectionsState = {...state, sections: action.payload };
            devLog('New state after SET_SECTIONS:', newSectionsState);
            return newSectionsState;
        case 'ADD_SECTION':
            devLog('Processing ADD_SECTION with payload:', action.payload);
            const newAddSectionState = {...state, sections: [...state.sections, action.payload] };
            devLog('New state after ADD_SECTION:', newAddSectionState);
            return newAddSectionState;
        case 'UPDATE_SECTION':
            devLog('Processing UPDATE_SECTION with payload:', action.payload);
            const newUpdateSectionState = {
                ...state,
                sections: state.sections.map(section =>
                    section.id === action.payload.id ? action.payload : section
                ),
            };
            devLog('New state after UPDATE_SECTION:', newUpdateSectionState);
            return newUpdateSectionState;
        case 'REMOVE_SECTION':
            devLog('Processing REMOVE_SECTION with payload:', action.payload);
            const newRemoveSectionState = {
                ...state,
                sections: state.sections.filter(section => section.id !== action.payload),
            };
            devLog('New state after REMOVE_SECTION:', newRemoveSectionState);
            return newRemoveSectionState;
        case 'REORDER_SECTIONS':
            devLog('Processing REORDER_SECTIONS with payload:', action.payload);
            const newReorderSectionsState = {...state, sections: action.payload };
            devLog('New state after REORDER_SECTIONS:', newReorderSectionsState);
            return newReorderSectionsState;
        case 'SET_SPEECH_ENGINE':
            devLog('Processing SET_SPEECH_ENGINE with payload:', action.payload);
            const newSpeechEngineState = {
                ...state,
                settings: {
                    ...state.settings,
                    speechEngine: action.payload,
                },
            };
            devLog('New state after SET_SPEECH_ENGINE:', newSpeechEngineState);
            return newSpeechEngineState;
        case 'SET_SELECTED_VOICE':
            {
                const { engine, voice } = action.payload;
                devLog('Processing SET_SELECTED_VOICE with payload:', action.payload);
                const newSelectedVoiceState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        selectedVoices: {
                            ...state.settings.selectedVoices,
                            [engine]: voice,
                        },
                    },
                };
                devLog('New state after SET_SELECTED_VOICE:', newSelectedVoiceState);
                return newSelectedVoiceState;
            }
        case 'ADD_CUSTOM_VOICE':
            {
                const { engine: customEngine, voice: customVoice } = action.payload;
                const currentCustomVoices = state.settings.customVoices[customEngine] || [];
                devLog('Processing ADD_CUSTOM_VOICE with payload:', action.payload);
                const newCustomVoiceState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        customVoices: {
                            ...state.settings.customVoices,
                            [customEngine]: [...currentCustomVoices, customVoice],
                        },
                    },
                };
                devLog('New state after ADD_CUSTOM_VOICE:', newCustomVoiceState);
                return newCustomVoiceState;
            }
        case 'REMOVE_CUSTOM_VOICE':
            {
                const { engine: removeEngine, voiceId } = action.payload;
                const updatedCustomVoices = (state.settings.customVoices[removeEngine] || []).filter(v => v.id !== voiceId);
                const updatedActiveVoices = {
                    ...state.settings.activeVoices,
                    [removeEngine]: (state.settings.activeVoices[removeEngine] || []).filter(v => v.id !== voiceId),
                };
                devLog('Processing REMOVE_CUSTOM_VOICE with payload:', action.payload);
                const newRemoveCustomVoiceState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        customVoices: {
                            ...state.settings.customVoices,
                            [removeEngine]: updatedCustomVoices,
                        },
                        activeVoices: updatedActiveVoices,
                    },
                };
                devLog('New state after REMOVE_CUSTOM_VOICE:', newRemoveCustomVoiceState);
                return newRemoveCustomVoiceState;
            }
        case 'ADD_ACTIVE_VOICE':
            {
                const { engine: activeEngine, voice: activeVoice } = action.payload;
                const currentActiveVoices = state.settings.activeVoices[activeEngine] || [];
                const voiceWithEngine = {...activeVoice, engine: activeEngine };
                devLog('Processing ADD_ACTIVE_VOICE with payload:', action.payload);
                if (!currentActiveVoices.some(v => v.id === voiceWithEngine.id)) {
                    let newDefaultVoice = state.settings.defaultVoice;
                    const allActiveVoices = Object.values(state.settings.activeVoices).flat();
                    if (allActiveVoices.length === 0) {
                        newDefaultVoice = { engine: activeEngine, voiceId: voiceWithEngine.id };
                    }
                    const newAddActiveVoiceState = {
                        ...state,
                        settings: {
                            ...state.settings,
                            activeVoices: {
                                ...state.settings.activeVoices,
                                [activeEngine]: [...currentActiveVoices, voiceWithEngine],
                            },
                            defaultVoice: newDefaultVoice,
                        },
                    };
                    devLog('New state after ADD_ACTIVE_VOICE:', newAddActiveVoiceState);
                    return newAddActiveVoiceState;
                }
                devLog('Voice already exists, state unchanged for ADD_ACTIVE_VOICE');
                return state;
            }
        case 'REMOVE_ACTIVE_VOICE':
            {
                const { engine: removeActiveEngine, voiceId } = action.payload;
                const activeForEngine = state.settings.activeVoices[removeActiveEngine] || [];
                const updatedActiveForEngine = activeForEngine.filter(v => v.id !== voiceId);
                const newActiveVoices = {
                    ...state.settings.activeVoices,
                    [removeActiveEngine]: updatedActiveForEngine,
                };
                let newDefaultVoice = state.settings.defaultVoice;
                if (
                    state.settings.defaultVoice &&
                    state.settings.defaultVoice.engine === removeActiveEngine &&
                    state.settings.defaultVoice.voiceId === voiceId
                ) {
                    const allRemainingVoices = Object.values(newActiveVoices).flat();
                    newDefaultVoice = allRemainingVoices.length > 0 ? { engine: allRemainingVoices[0].engine, voiceId: allRemainingVoices[0].id } : null;
                }
                devLog('Processing REMOVE_ACTIVE_VOICE with payload:', action.payload);
                const newRemoveActiveVoiceState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        activeVoices: newActiveVoices,
                        defaultVoice: newDefaultVoice,
                    },
                };
                devLog('New state after REMOVE_ACTIVE_VOICE:', newRemoveActiveVoiceState);
                return newRemoveActiveVoiceState;
            }
        case 'SET_API_KEY':
            {
                const { keyName, value } = action.payload;
                devLog('Processing SET_API_KEY with payload:', action.payload);
                const newApiKeyState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        [keyName]: value,
                    },
                };
                devLog('New state after SET_API_KEY:', newApiKeyState);
                return newApiKeyState;
            }
        case 'ADD_API_KEY':
            {
                const { keyArray, keyValue } = action.payload;
                devLog('Processing ADD_API_KEY with payload:', action.payload);
                const newAddApiKeyState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        [keyArray]: [...(state.settings[keyArray] || []), keyValue],
                    },
                };
                devLog('New state after ADD_API_KEY:', newAddApiKeyState);
                return newAddApiKeyState;
            }
        case 'REMOVE_API_KEY':
            {
                const { keyArray: removeKeyArray, index: removeIndex } = action.payload;
                devLog('Processing REMOVE_API_KEY with payload:', action.payload);
                const newRemoveApiKeyState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        [removeKeyArray]: state.settings[removeKeyArray].filter((_, i) => i !== removeIndex),
                    },
                };
                devLog('New state after REMOVE_API_KEY:', newRemoveApiKeyState);
                return newRemoveApiKeyState;
            }
        case 'SET_ACTIVE_TAB':
            const newActiveTabState = {...state, activeTab: action.payload };
            return newActiveTabState;
        case 'SET_PROCESSING':
            const newProcessingState = {...state, isProcessing: action.payload };
            return newProcessingState;
        case 'SET_ERROR':
            const newErrorState = {...state, errorMessage: action.payload };
            return newErrorState;
        case 'SET_NOTIFICATION':
            const newNotificationState = {...state, notification: action.payload };
            return newNotificationState;
        case 'SET_GENERATED_AUDIO':
            devLog('Processing SET_GENERATED_AUDIO with payload:', action.payload);
            const newGeneratedAudioState = {
                ...state,
                generatedAudios: {
                    ...state.generatedAudios,
                    [action.payload.sectionId]: action.payload.audioUrl,
                },
            };
            devLog('New state after SET_GENERATED_AUDIO:', newGeneratedAudioState);
            return newGeneratedAudioState;
        case 'SET_MERGED_AUDIO':
            devLog('Processing SET_MERGED_AUDIO with payload:', action.payload);
            const newMergedAudioState = {...state, mergedAudio: action.payload };
            devLog('New state after SET_MERGED_AUDIO:', newMergedAudioState);
            return newMergedAudioState;
        case 'SET_PLAYING':
            devLog('Processing SET_PLAYING with payload:', action.payload);
            const newPlayingState = {...state, isPlaying: action.payload };
            devLog('New state after SET_PLAYING:', newPlayingState);
            return newPlayingState;
        case 'SAVE_AUDIO':
            devLog('Processing SAVE_AUDIO with payload:', action.payload);
            const newSaveAudioState = {
                ...state,
                savedAudios: {
                    ...state.savedAudios,
                    [action.payload.id]: action.payload,
                },
            };
            devLog('New state after SAVE_AUDIO:', newSaveAudioState);
            return newSaveAudioState;
        case 'DELETE_AUDIO':
            devLog('Processing DELETE_AUDIO with payload:', action.payload);
            const {
                [action.payload]: removedAudio,
                ...remainingAudios
            } = state.savedAudios;
            const newDeleteAudioState = {...state, savedAudios: remainingAudios };
            devLog('New state after DELETE_AUDIO:', newDeleteAudioState);
            return newDeleteAudioState;
        case 'LOAD_AUDIO_LIBRARY':
            devLog('Processing LOAD_AUDIO_LIBRARY with payload:', action.payload);
            const newLoadAudioLibraryState = {
                ...state,
                savedAudios: action.payload && typeof action.payload === 'object' ? action.payload : {},
            };
            devLog('New state after LOAD_AUDIO_LIBRARY:', newLoadAudioLibraryState);
            return newLoadAudioLibraryState;
        case 'SET_SELECTED_AUDIO':
            devLog('Processing SET_SELECTED_AUDIO with payload:', action.payload);
            const newSelectedAudioState = {...state, selectedAudioId: action.payload };
            devLog('New state after SET_SELECTED_AUDIO:', newSelectedAudioState);
            return newSelectedAudioState;
        case 'SET_MODE':
            devLog('Processing SET_MODE with payload:', action.payload);
            const newMode = action.payload;
            if (newMode === 'demo') {
                const filteredActiveVoices = {};
                Object.keys(state.settings.activeVoices).forEach(engine => {
                    if (engine === 'gtts') {
                        filteredActiveVoices[engine] = state.settings.activeVoices[engine];
                    }
                });
                const newDemoModeState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        mode: newMode,
                        speechEngine: 'gtts',
                        activeVoices: filteredActiveVoices,
                    },
                };
                devLog('New state after SET_MODE (demo):', newDemoModeState);
                return newDemoModeState;
            }
            const newModeState = {
                ...state,
                settings: {
                    ...state.settings,
                    mode: newMode,
                },
            };
            devLog('New state after SET_MODE:', newModeState);
            return newModeState;
        case 'LOAD_DEMO_CONTENT':
            {
                const { mode, speechEngine, ...rest } = action.payload;
                devLog('Processing LOAD_DEMO_CONTENT with payload:', action.payload);
                const newDemoContentState = {
                    ...state,
                    settings: {
                        ...state.settings,
                        ...(mode !== undefined ? { mode } : {}),
                        ...(speechEngine !== undefined ? { speechEngine } : {}),
                    },
                    ...rest,
                };
                devLog('New state after LOAD_DEMO_CONTENT:', newDemoContentState);
                return newDemoContentState;
            }
        case 'RESET_STATE':
            devLog('Processing RESET_STATE with payload:', action.payload);
            if (typeof window !== 'undefined') {
                removeFromStorage('tts_active_voices');
                removeFromStorage('tts_default_voice');
                removeFromStorage('tts_custom_voices');
                removeFromStorage('tts_elevenLabsApiKeys');
                removeFromStorage('tts_awsPollyCredentials');
                removeFromStorage('tts_googleCloudCredentials');
                removeFromStorage('tts_azureTTSCredentials');
                removeFromStorage('tts_ibmWatsonCredentials');
                removeFromStorage('tts_anthropicApiKey');
                removeFromStorage('tts_openaiApiKey');
                removeFromStorage('tts_mode');
            }
            const newResetState = {
                ...state,
                settings: initialState.settings,
                activeTab: 'settings',
            };
            devLog('New state after RESET_STATE:', newResetState);
            return newResetState;
        case 'SAVE_TEMPLATE':
            devLog('Processing SAVE_TEMPLATE with payload:', action.payload);
            const newSaveTemplateState = {
                ...state,
                templates: {
                    ...state.templates,
                    [action.payload.id]: action.payload,
                },
            };
            devLog('New state after SAVE_TEMPLATE:', newSaveTemplateState);
            return newSaveTemplateState;
        case 'DELETE_TEMPLATE':
            devLog('Processing DELETE_TEMPLATE with payload:', action.payload);
            const {
                [action.payload]: removedTemplate,
                ...remainingTemplates
            } = state.templates;
            const newDeleteTemplateState = {...state, templates: remainingTemplates };
            devLog('New state after DELETE_TEMPLATE:', newDeleteTemplateState);
            return newDeleteTemplateState;
        case 'LOAD_TEMPLATES':
            devLog('Processing LOAD_TEMPLATES with payload:', action.payload);
            const newLoadTemplatesState = {
                ...state,
                templates: action.payload && typeof action.payload === 'object' ? action.payload : {},
            };
            devLog('New state after LOAD_TEMPLATES:', newLoadTemplatesState);
            return newLoadTemplatesState;
        case 'SET_DEFAULT_VOICE':
            devLog('Processing SET_DEFAULT_VOICE with payload:', action.payload);
            const newDefaultVoiceState = {
                ...state,
                settings: {...state.settings, defaultVoice: action.payload },
            };
            devLog('New state after SET_DEFAULT_VOICE:', newDefaultVoiceState);
            return newDefaultVoiceState;
        case 'LOAD_ACTIVE_VOICES':
            devLog('Processing LOAD_ACTIVE_VOICES with payload:', action.payload);
            const newLoadActiveVoicesState = {
                ...state,
                settings: {...state.settings, activeVoices: action.payload },
            };
            devLog('New state after LOAD_ACTIVE_VOICES:', newLoadActiveVoicesState);
            return newLoadActiveVoicesState;
        case 'LOAD_CUSTOM_VOICES':
            devLog('Processing LOAD_CUSTOM_VOICES with payload:', action.payload);
            const newLoadCustomVoicesState = {
                ...state,
                settings: {...state.settings, customVoices: action.payload },
            };
            devLog('New state after LOAD_CUSTOM_VOICES:', newLoadCustomVoicesState);
            return newLoadCustomVoicesState;
        default:
            devLog('Unhandled action type in ttsReducer:', action.type, 'Payload:', action.payload);
            return state;
    }
}