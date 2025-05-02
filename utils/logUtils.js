// utils\logUtils.js

export const devLog = (...args) => {
    if (process.env.NODE_ENV === 'development') {
        console.log('[TTS]', ...args);
    }
};

export const devError = (...args) => {
    if (process.env.NODE_ENV === 'development') {
        console.error('[TTS]', ...args);
    }
};

export const devWarn = (...args) => {
    if (process.env.NODE_ENV === 'development') {
        console.warn('[TTS]', ...args);
    }
};