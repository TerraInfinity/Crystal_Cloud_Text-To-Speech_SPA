import React, { createContext, useContext, useState, useEffect } from 'react';

const ApiKeyConfirmContext = createContext({
  showPrompts: true,
  isConfirmOpen: false,
  isProcessing: false,
  currentConfirmCallback: null,
  currentApiKeyInfo: null,
  setShowPrompts: () => {},
  showConfirm: () => {},
  handleConfirm: () => {},
  handleSkip: () => {},
  handleCancel: () => {},
});

export const ApiKeyConfirmProvider = ({ children }) => {
  const [showPrompts, setShowPrompts] = useState(true);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentConfirmCallback, setCurrentConfirmCallback] = useState(null);
  const [currentApiKeyInfo, setCurrentApiKeyInfo] = useState(null);

  // Reset processing state on mount to prevent persistence on refresh
  useEffect(() => {
    setIsProcessing(false);
    // Optionally clear any sessionStorage if used
    sessionStorage.removeItem('apiKeyProcessing');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsConfirmOpen(false);
      setIsProcessing(false);
      setCurrentConfirmCallback(null);
      setCurrentApiKeyInfo(null);
    };
  }, []);

  // Show confirmation dialog and return a promise
  const showConfirm = (apiKeyInfo) => {
    return new Promise((resolve) => {
      setCurrentApiKeyInfo(apiKeyInfo);
      setCurrentConfirmCallback(() => resolve);
      setIsConfirmOpen(true);
    });
  };

  // User confirms to proceed to next key
  const handleConfirm = async (dontAskAgain = false, overrideKey = null) => {
    setIsProcessing(true);
    try {
      if (dontAskAgain) {
        setShowPrompts(false);
      }
      setIsConfirmOpen(false);
      if (currentConfirmCallback) {
        currentConfirmCallback({ proceed: true, dontAskAgain, overrideKey });
      }
    } finally {
      setIsProcessing(false);
      setCurrentConfirmCallback(null);
      setCurrentApiKeyInfo(null);
      sessionStorage.removeItem('apiKeyProcessing');
    }
  };

  // User wants to skip this key
  const handleSkip = () => {
    setIsConfirmOpen(false);
    setIsProcessing(false);
    if (currentConfirmCallback) {
      currentConfirmCallback({ proceed: true, dontAskAgain: false });
    }
    setCurrentConfirmCallback(null);
    setCurrentApiKeyInfo(null);
    sessionStorage.removeItem('apiKeyProcessing');
  };

  // User cancels the entire operation
  const handleCancel = () => {
    setIsConfirmOpen(false);
    setIsProcessing(false);
    if (currentConfirmCallback) {
      currentConfirmCallback({ proceed: false, dontAskAgain: false });
    }
    setCurrentConfirmCallback(null);
    setCurrentApiKeyInfo(null);
    sessionStorage.removeItem('apiKeyProcessing');
  };

  return (
    <ApiKeyConfirmContext.Provider
      value={{
        showPrompts,
        isConfirmOpen,
        isProcessing,
        currentApiKeyInfo,
        setShowPrompts,
        showConfirm,
        handleConfirm,
        handleSkip,
        handleCancel,
      }}
    >
      {children}
    </ApiKeyConfirmContext.Provider>
  );
};

export const useApiKeyConfirm = () => useContext(ApiKeyConfirmContext);

export default ApiKeyConfirmContext;