// context/notificationContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { notificationManager, Notification } from '../utils/notificationManager';

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'isExiting' | 'createdAt' | 'expiresAt'>) => void;
  removeNotification: (id: string) => void;
  finalizeRemoval: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // This state is just used to trigger re-renders when the manager updates
  const [notifications, setNotifications] = useState<Notification[]>(notificationManager.getNotifications());

  // Subscribe to notification changes
  useEffect(() => {
    console.log('Setting up notification subscriber');
    
    // The callback will be called whenever the notification manager state changes
    const unsubscribe = notificationManager.subscribe(() => {
      setNotifications(notificationManager.getNotifications());
    });
    
    // Cleanup on unmount
    return () => {
      console.log('Cleaning up notification subscriber');
      unsubscribe();
    };
  }, []);

  const contextValue: NotificationContextType = {
    notifications,
    addNotification: (notification) => notificationManager.addNotification(notification),
    removeNotification: (id) => notificationManager.markAsExiting(id),
    finalizeRemoval: (id) => notificationManager.removeNotification(id)
  };

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};