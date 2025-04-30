// utils\logUtils.js

export const devLog = (...args) => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('[TTS]', ...args);
    }
};