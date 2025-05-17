// components/notification.tsx
import React, { useRef, memo, useEffect, useState } from 'react';
import { useNotification } from '../context/notificationContext';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import type { Notification } from '../utils/notificationManager';

// Individual notification component with self-managed timer
const NotificationItem: React.FC<{
  notification: Notification;
  removeNotification: (id: string) => void;
  finalizeRemoval: (id: string) => void;
}> = memo(({ notification, removeNotification, finalizeRemoval }) => {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [autoExitTriggered, setAutoExitTriggered] = useState(false);
  
  // Independent timer for this specific notification
  useEffect(() => {
    const duration = notification.expiresAt 
      ? notification.expiresAt - Date.now() 
      : 3000; // Default 3 seconds
    
    console.log(`NotificationItem ${notification.id} setting timer for ${duration}ms`);
    
    // Set timer for auto-dismissal
    const timerId = setTimeout(() => {
      console.log(`NotificationItem ${notification.id} timer expired, triggering exit`);
      setAutoExitTriggered(true);
      setIsVisible(false);
    }, Math.max(0, duration));
    
    // Cleanup timer on unmount
    return () => {
      console.log(`NotificationItem ${notification.id} cleanup - clearing timer`);
      clearTimeout(timerId);
    };
  }, [notification.id, notification.expiresAt]);
  
  // Handle manual close
  const handleClose = () => {
    console.log(`NotificationItem ${notification.id} manual close triggered`);
    setIsVisible(false);
  };
  
  // When exit animation completes, remove from DOM completely
  const handleExited = () => {
    console.log(`NotificationItem ${notification.id} exit animation completed, finalizing removal`);
    finalizeRemoval(notification.id);
  };

  return (
    <CSSTransition
      timeout={500}
      classNames="notification"
      nodeRef={nodeRef}
      in={isVisible}
      onExit={() => console.log(`Notification ${notification.id} starting exit animation`)}
      onExited={handleExited}
      unmountOnExit
    >
      <div
        ref={nodeRef}
        className={`notification notification-${notification.type}`}
        role="alert"
        aria-live="polite"
        data-notification-id={notification.id}
      >
        {notification.message}
        <button
          className="close-button" 
          onClick={handleClose}
          aria-label="Close notification"
        >
          ×
        </button>
        <div className="notification-progress-bar"></div>
      </div>
    </CSSTransition>
  );
});

const Notification: React.FC = () => {
  const { notifications, removeNotification, finalizeRemoval } = useNotification();

  if (!notifications.length) {
    return null;
  }

  // Sort by creation time, newest first
  const sortedNotifications = [...notifications].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="notification-container">
      <TransitionGroup>
        {sortedNotifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            removeNotification={removeNotification}
            finalizeRemoval={finalizeRemoval}
          />
        ))}
      </TransitionGroup>
    </div>
  );
};

export default Notification;