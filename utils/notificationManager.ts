import { v4 as uuidv4 } from 'uuid';

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  message: string;
  isExiting: boolean;
  createdAt: number;
  expiresAt?: number; // Make expiresAt optional in the interface
}

// If this module already has a manager defined (from a previous HMR update),
// reuse it to maintain state
declare global {
  interface Window {
    __NOTIFICATION_MANAGER?: NotificationManager;
    __NOTIFICATION_INTERVAL_ID?: NodeJS.Timeout;
  }
}

export class NotificationManager {
  private notifications: Notification[] = [];
  private subscribers = new Set<() => void>();
  private MAX_NOTIFICATIONS = 3;
  private DISPLAY_DURATION = 3000; // 3 seconds
  
  constructor() {
    console.log('NotificationManager instantiated', new Date().toISOString());
    
    // No need for global interval anymore - each notification manages its own timing
    if (typeof window !== 'undefined' && window.__NOTIFICATION_INTERVAL_ID) {
      console.log('Clearing existing notification interval');
      clearInterval(window.__NOTIFICATION_INTERVAL_ID);
      window.__NOTIFICATION_INTERVAL_ID = undefined;
    }
  }
  
  getNotifications(): Notification[] {
    return [...this.notifications];
  }
  
  addNotification(notification: Omit<Notification, 'id' | 'isExiting' | 'createdAt' | 'expiresAt'>): void {
    const id = uuidv4();
    const createdAt = Date.now();
    const expiresAt = createdAt + this.DISPLAY_DURATION;
    
    console.log(`[NotificationManager] Adding notification ${id}: ${notification.message} at ${new Date(createdAt).toISOString()}, expires at ${new Date(expiresAt).toISOString()}`);
    
    // Check for duplicates (same message in last 2 seconds)
    const isDuplicate = this.notifications.some(n => 
      n.message === notification.message && 
      Date.now() - n.createdAt < 2000
    );
    
    if (isDuplicate) {
      console.log(`[NotificationManager] Duplicate notification detected, skipping: ${notification.message}`);
      return;
    }
    
    // Create new notification
    const newNotification: Notification = {
      ...notification,
      id,
      isExiting: false,
      createdAt,
      expiresAt
    };
    
    // Get count of non-exiting notifications
    const activeCount = this.getVisibleCount();
    console.log(`[NotificationManager] Current active notification count: ${activeCount}`);
    
    let updatedNotifications = [...this.notifications];
    
    // If we're at the limit, mark the oldest for removal
    if (activeCount >= this.MAX_NOTIFICATIONS) {
      console.log(`[NotificationManager] Max notifications (${this.MAX_NOTIFICATIONS}) reached, removing oldest`);
      
      // Find oldest non-exiting notification
      const activeNotifications = updatedNotifications
        .filter(n => !n.isExiting)
        .sort((a, b) => a.createdAt - b.createdAt);
      
      if (activeNotifications.length > 0) {
        const oldest = activeNotifications[0];
        console.log(`[NotificationManager] Removing oldest notification: ${oldest.id} created at ${new Date(oldest.createdAt).toISOString()}`);
        
        // Remove the oldest directly instead of just marking it
        this.removeNotification(oldest.id);
        
        // Update our local copy after removal
        updatedNotifications = [...this.notifications];
      }
    }
    
    // Use the updated notifications plus the new one
    this.notifications = [...updatedNotifications, newNotification];
    
    // Notify subscribers
    this.notifySubscribers();
  }
  
  private getVisibleCount(): number {
    return this.notifications.filter(n => !n.isExiting).length;
  }
  
  // This is now only used for manual dismissal
  markAsExiting(id: string): void {
    console.log(`[NotificationManager] Marking notification as exiting: ${id}`);
    
    // Find notification
    const notification = this.notifications.find(n => n.id === id);
    if (!notification) {
      console.log(`[NotificationManager] Notification ${id} not found when trying to mark as exiting`);
      return;
    }
    
    // Mark as exiting
    notification.isExiting = true;
    
    // Notify subscribers
    this.notifySubscribers();
  }
  
  removeNotification(id: string): void {
    console.log(`[NotificationManager] Removing notification: ${id}`);
    
    // First check if it exists to avoid extra work
    const notificationExists = this.notifications.some(n => n.id === id);
    
    if (!notificationExists) {
      console.log(`[NotificationManager] Notification ${id} not found when trying to remove, skipping`);
      return;
    }
    
    // Remove from list
    const oldLength = this.notifications.length;
    this.notifications = this.notifications.filter(n => n.id !== id);
    const newLength = this.notifications.length;
    
    if (oldLength === newLength) {
      console.log(`[NotificationManager] Warning: Failed to remove notification ${id}`);
    } else {
      console.log(`[NotificationManager] Successfully removed notification ${id}`);
    }
    
    // Notify subscribers
    this.notifySubscribers();
  }
  
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }
  
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('[NotificationManager] Error in subscriber callback:', error);
      }
    });
  }
  
  // Clear all notifications
  clear(): void {
    console.log('[NotificationManager] Clearing all notifications');
    this.notifications = [];
    this.notifySubscribers();
  }
  
  // For debugging
  debugState(): void {
    console.log('=== NOTIFICATION MANAGER DEBUG ===');
    console.log(`Total notifications: ${this.notifications.length}`);
    console.log(`Active notifications: ${this.getVisibleCount()}`);
    console.log('Notifications:');
    this.notifications.forEach(n => {
      console.log(`- ID: ${n.id}, Type: ${n.type}, Exiting: ${n.isExiting}, Created: ${new Date(n.createdAt).toISOString()}, Expires: ${n.expiresAt ? new Date(n.expiresAt).toISOString() : 'N/A'}`);
    });
    console.log('===================================');
  }
}

// Create or reuse singleton manager
const getNotificationManager = (): NotificationManager => {
  if (typeof window !== 'undefined') {
    // Reuse existing manager if available (persists through HMR)
    if (!window.__NOTIFICATION_MANAGER) {
      console.log('Creating new notification manager instance');
      window.__NOTIFICATION_MANAGER = new NotificationManager();
    } else {
      console.log('Reusing existing notification manager instance');
    }
    return window.__NOTIFICATION_MANAGER;
  }
  
  // For SSR, create a new instance that won't be reused
  console.log('Creating server-side notification manager (will not persist)');
  return new NotificationManager();
};

// Add a global action to debug the notification manager
if (typeof window !== 'undefined') {
  (window as any).debugNotifications = () => {
    if (window.__NOTIFICATION_MANAGER) {
      window.__NOTIFICATION_MANAGER.debugState();
    } else {
      console.log('No notification manager instance found');
    }
  };
}

export const notificationManager = getNotificationManager(); 