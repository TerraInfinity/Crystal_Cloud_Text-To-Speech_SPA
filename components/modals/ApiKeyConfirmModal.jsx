import React, { useState, useEffect, useRef } from 'react';
import { useApiKeyConfirm } from '../../context/apiKeyConfirmContext';

const maskApiKey = (key) => {
  if (!key || key.length < 9) return key || '';
  const first4 = key.substring(0, 4);
  const last4 = key.substring(key.length - 4);
  const middleLength = key.length - 8;
  const maskedMiddle = '*'.repeat(Math.min(middleLength, 20));
  return `${first4}${maskedMiddle}${last4}`;
};

const ApiKeyConfirmModal = () => {
  const {
    isConfirmOpen,
    isProcessing,
    currentApiKeyInfo,
    handleConfirm,
    handleSkip,
    handleCancel,
  } = useApiKeyConfirm();

  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [overrideKey, setOverrideKey] = useState('');
  const [showOverrideInput, setShowOverrideInput] = useState(false);
  const modalRef = useRef(null);
  const firstFocusableRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isConfirmOpen) {
        handleCancel();
      }
    };

    const trapFocus = (event) => {
      const focusableElements = modalRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements?.[0];
      const lastElement = focusableElements?.[focusableElements.length - 1];

      if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', trapFocus);

    if (isConfirmOpen && firstFocusableRef.current) {
      firstFocusableRef.current.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', trapFocus);
    };
  }, [isConfirmOpen, handleCancel]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  };

  if (!isConfirmOpen) return null;

  const { 
    failedKeyName, 
    errorMessage, 
    nextKeyName, 
    apiKey,
    requestDetails 
  } = currentApiKeyInfo || {};

  const maskedKey = maskApiKey(apiKey);

  const handleOverrideConfirm = () => {
    handleConfirm(dontAskAgain, overrideKey);
  };

  return (
    <div
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div 
        className="modal-content"
        ref={modalRef}
        role="dialog"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 id="modal-title" className="text-xl font-semibold">
            API Key Failure
          </h3>
          <button
            ref={firstFocusableRef}
            onClick={handleCancel}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
            disabled={isProcessing}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div id="modal-description" className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">
              The API key <span className="font-medium">{failedKeyName}</span> failed with the following error:
            </p>
            <div className="notification-error p-3 rounded-md mt-2 text-sm overflow-auto max-h-32">
              {errorMessage}
            </div>
          </div>

          {apiKey && (
            <div>
              <p className="text-sm font-medium text-gray-700">Failed API Key (Partial):</p>
              <div className="bg-gray-50 p-2 rounded-md mt-1 font-mono text-xs text-gray-800">
                {maskedKey}
              </div>
            </div>
          )}

          {requestDetails && (
            <details className="mt-2">
              <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                Request Details
              </summary>
              <pre className="bg-gray-800 text-gray-100 p-3 rounded-md mt-1 text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                {JSON.stringify(requestDetails, null, 2)}
              </pre>
            </details>
          )}

          <p className="text-sm text-gray-600">
            Would you like to try the next API key: <span className="font-medium">{nextKeyName}</span>?
          </p>

          <div>
            <button
              onClick={() => setShowOverrideInput(!showOverrideInput)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              aria-expanded={showOverrideInput}
              disabled={isProcessing}
            >
              {showOverrideInput ? 'Hide override option' : 'Try with my own API key'}
            </button>
            {showOverrideInput && (
              <div className="mt-3 space-y-2">
                <label htmlFor="override-key" className="block text-sm font-medium text-gray-700">
                  Override API Key
                </label>
                <input
                  id="override-key"
                  type="text"
                  value={overrideKey}
                  onChange={(e) => setOverrideKey(e.target.value)}
                  placeholder="Enter your API key"
                  className="input-field"
                  aria-describedby="override-key-help"
                  disabled={isProcessing}
                />
                <p id="override-key-help" className="text-xs text-gray-500">
                  This key will be used for this request only and won’t be saved.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              id="dont-ask-again"
              type="checkbox"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={isProcessing}
            />
            <label htmlFor="dont-ask-again" className="ml-2 text-sm text-gray-600">
              Automatically try the next key in the future
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3 relative">
          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-md">
              <div className="spinner" aria-label="Processing API key confirmation"></div>
            </div>
          )}
          <button
            onClick={handleCancel}
            className="btn btn-secondary"
            disabled={isProcessing}
          >
            Cancel
          </button>
          {showOverrideInput && (
            <button
              onClick={handleOverrideConfirm}
              disabled={!overrideKey.trim() || isProcessing}
              className={`btn btn-primary ${!overrideKey.trim() || isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Try Override Key
            </button>
          )}
          <button
            onClick={() => handleConfirm(dontAskAgain)}
            className="btn btn-primary"
            disabled={isProcessing}
          >
            Try Next Key
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyConfirmModal;