import type { OrderEvent, EventCallback } from '../types';

/**
 * Connection states for the WebSocket
 */
export const ConnectionState = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR'
} as const;

export type ConnectionState = typeof ConnectionState[keyof typeof ConnectionState];

/**
 * Subscription interface for managing channel subscriptions
 */
interface Subscription {
  channel: string;
  callback: EventCallback;
}

/**
 * Reconnection configuration
 */
interface ReconnectionConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffRate: number;
}

/**
 * AppSync Events Service
 * Manages WebSocket connections to AppSync Events API for real-time order updates
 */
class AppSyncEventsService {
  private ws: WebSocket | null = null;
  private url: string;
  private apiKey: string;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private subscriptions: Map<string, Subscription[]> = new Map();
  private subscriptionIdToChannel: Map<string, string> = new Map(); // Track subscription ID to channel mapping
  private reconnectionConfig: ReconnectionConfig = {
    maxAttempts: 10,
    initialDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffRate: 2.0
  };
  private reconnectionAttempts: number = 0;
  private reconnectionTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private connectionStateCallbacks: Set<(state: ConnectionState) => void> = new Set();
  private shouldReconnect: boolean = true;

  constructor() {
    this.url = import.meta.env.VITE_APPSYNC_EVENTS_URL || '';
    this.apiKey = import.meta.env.VITE_APPSYNC_EVENTS_API_KEY || '';
    
    // Log configuration status for debugging
    if (!this.url || !this.apiKey) {
      console.warn('[AppSync Events] Configuration missing:', {
        hasUrl: !!this.url,
        hasApiKey: !!this.apiKey
      });
      console.warn('[AppSync Events] Real-time updates will be disabled. Please check your .env file and restart the dev server.');
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Register a callback for connection state changes
   */
  onConnectionStateChange(callback: (state: ConnectionState) => void): () => void {
    this.connectionStateCallbacks.add(callback);
    // Return unsubscribe function
    return () => {
      this.connectionStateCallbacks.delete(callback);
    };
  }

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      console.log(`[AppSync Events] Connection state: ${state}`);
      this.connectionStateCallbacks.forEach(callback => callback(state));
    }
  }

  /**
   * Connect to AppSync Events WebSocket
   * Establishes WebSocket connection with authentication
   */
  async connect(): Promise<void> {
    if (this.connectionState === ConnectionState.CONNECTED || 
        this.connectionState === ConnectionState.CONNECTING) {
      console.log('[AppSync Events] Already connected or connecting');
      return;
    }

    if (!this.url || !this.apiKey) {
      throw new Error('AppSync Events URL or API Key not configured');
    }

    this.setConnectionState(ConnectionState.CONNECTING);
    this.shouldReconnect = true;

    try {
      // Construct WebSocket URL
      const wsUrl = this.buildWebSocketUrl();
      
      console.log('[AppSync Events] Connecting to WebSocket...');
      console.log('[AppSync Events] URL:', wsUrl);
      
      // Get auth subprotocol
      const authSubprotocol = this.getAuthSubprotocol();
      
      // Create WebSocket with header-based auth subprotocol and aws-appsync-event-ws
      this.ws = new WebSocket(wsUrl, [authSubprotocol, 'aws-appsync-event-ws']);

      // Set up event handlers
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onclose = this.handleClose.bind(this);

    } catch (error) {
      console.error('[AppSync Events] Connection error:', error);
      this.setConnectionState(ConnectionState.ERROR);
      this.scheduleReconnection();
      throw error;
    }
  }

  /**
   * Build WebSocket URL with authentication parameters
   * AppSync Events requires the realtime endpoint with auth header as query param
   */
  private buildWebSocketUrl(): string {
    if (!this.url) {
      throw new Error('AppSync Events URL is not configured.');
    }
    
    try {
      const httpUrl = new URL(this.url);
      const realtimeHost = httpUrl.host.replace('.appsync-api.', '.appsync-realtime-api.');
      const realtimeUrl = `wss://${realtimeHost}/event/realtime`;
      
      return realtimeUrl;
    } catch (error) {
      throw new Error(`Invalid AppSync Events URL: "${this.url}".`);
    }
  }

  /**
   * Get Base64URL encoded authorization header
   * Required for AppSync Events WebSocket subprotocol
   */
  private getBase64URLEncoded(obj: any): string {
    return btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')  // Convert '+' to '-'
      .replace(/\//g, '_')  // Convert '/' to '_'
      .replace(/=+$/, '');  // Remove padding '='
  }

  /**
   * Get authorization subprotocol for WebSocket connection
   * Format: header-{base64url-encoded-auth-object}
   */
  private getAuthSubprotocol(): string {
    const httpUrl = new URL(this.url);
    const authObject = {
      host: httpUrl.host,
      'x-api-key': this.apiKey
    };
    
    const encodedHeader = this.getBase64URLEncoded(authObject);
    return `header-${encodedHeader}`;
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('[AppSync Events] WebSocket connected');
    
    // Send connection_init - auth is in URL query params
    const connectionInit = {
      type: 'connection_init'
    };
    
    this.ws!.send(JSON.stringify(connectionInit));
    console.log('[AppSync Events] Sent connection_init');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      console.log('[AppSync Events] Received message:', message.type);
      
      // Handle different message types
      if (message.type === 'connection_ack') {
        console.log('[AppSync Events] Connection acknowledged');
        this.setConnectionState(ConnectionState.CONNECTED);
        this.reconnectionAttempts = 0;
        
        // Start heartbeat to keep connection alive
        this.startHeartbeat();
        
        // Resubscribe to all channels after reconnection
        this.resubscribeAll();
        return;
      }

      if (message.type === 'ka') {
        // Keep-alive message
        console.log('[AppSync Events] Keep-alive received');
        return;
      }

      if (message.type === 'subscribe_success') {
        console.log('[AppSync Events] Subscription confirmed:', message.id);
        return;
      }

      if (message.type === 'data') {
        // Event data received
        console.log('[AppSync Events] Event data received:', message);
        this.handleEventData(message);
        return;
      }

      if (message.type === 'subscribe_error') {
        console.warn('[AppSync Events] Subscription error:', message);
        console.warn('[AppSync Events] This is normal if the channel does not exist yet (no events published)');
        // Don't treat this as a fatal error - the channel may not exist yet
        return;
      }

      if (message.type === 'error') {
        // Check if it's an UnsupportedOperation error (can be ignored)
        const isUnsupportedOp = message.errors?.some((err: any) => 
          err.errorType === 'UnsupportedOperation'
        );
        
        if (!isUnsupportedOp) {
          console.error('[AppSync Events] Server error:', message);
          if (message.errors && Array.isArray(message.errors)) {
            message.errors.forEach((err: any) => {
              console.error('[AppSync Events] Error detail:', err);
            });
          }
        }
        return;
      }

      if (message.type === 'connection_error') {
        console.error('[AppSync Events] Connection error:', message);
        if (message.errors && Array.isArray(message.errors)) {
          message.errors.forEach((err: any) => {
            console.error('[AppSync Events] Connection error detail:', err);
          });
        }
        return;
      }

      console.log('[AppSync Events] Unknown message type:', message.type);

    } catch (error) {
      console.error('[AppSync Events] Failed to parse message:', error, event.data);
    }
  }

  /**
   * Handle event data from subscribed channels
   */
  private handleEventData(message: any): void {
    // AppSync Events sends event as a JSON string in the 'event' field
    const event = message.event;
    
    if (!event) {
      console.warn('[AppSync Events] Invalid event data:', message);
      return;
    }

    // Parse the event JSON string
    let orderEvent: OrderEvent;
    try {
      orderEvent = typeof event === 'string' ? JSON.parse(event) : event;
    } catch (error) {
      console.error('[AppSync Events] Failed to parse event:', error, event);
      return;
    }

    // Get channel from subscription ID
    const subscriptionId = message.id;
    const channel = this.subscriptionIdToChannel.get(subscriptionId);
    
    if (!channel) {
      console.warn('[AppSync Events] Received event for unknown subscription ID:', subscriptionId);
      return;
    }
    
    // Find subscriptions for this specific channel
    const channelSubscriptions = this.subscriptions.get(channel);
    if (!channelSubscriptions) {
      console.warn('[AppSync Events] No subscriptions found for channel:', channel);
      return;
    }
    
    // Call all callbacks for this channel only
    channelSubscriptions.forEach(subscription => {
      try {
        subscription.callback(orderEvent);
      } catch (error) {
        console.error(`[AppSync Events] Error in subscription callback for channel ${channel}:`, error);
      }
    });
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('[AppSync Events] WebSocket error:', event);
    this.setConnectionState(ConnectionState.ERROR);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log(`[AppSync Events] WebSocket closed: ${event.code} - ${event.reason}`);
    this.stopHeartbeat();
    
    if (this.shouldReconnect && this.reconnectionAttempts < this.reconnectionConfig.maxAttempts) {
      this.setConnectionState(ConnectionState.RECONNECTING);
      this.scheduleReconnection();
    } else {
      this.setConnectionState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Send ping every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  /**
   * Stop heartbeat interval
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnection(): void {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
    }

    const delay = Math.min(
      this.reconnectionConfig.initialDelay * Math.pow(
        this.reconnectionConfig.backoffRate,
        this.reconnectionAttempts
      ),
      this.reconnectionConfig.maxDelay
    );

    console.log(`[AppSync Events] Reconnecting in ${delay}ms (attempt ${this.reconnectionAttempts + 1}/${this.reconnectionConfig.maxAttempts})`);

    this.reconnectionTimer = setTimeout(() => {
      this.reconnectionAttempts++;
      this.connect().catch(error => {
        console.error('[AppSync Events] Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Resubscribe to all channels after reconnection
   */
  private resubscribeAll(): void {
    if (this.subscriptions.size === 0) {
      return;
    }

    console.log(`[AppSync Events] Resubscribing to ${this.subscriptions.size} channels`);
    
    this.subscriptions.forEach((_, channel) => {
      this.sendSubscribeMessage(channel);
    });
  }

  /**
   * Send subscribe message to WebSocket
   * Format according to AppSync Events protocol
   */
  private sendSubscribeMessage(channel: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[AppSync Events] Cannot subscribe to ${channel}: WebSocket not connected`);
      return;
    }

    // Generate unique subscription ID
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Ensure channel has leading slash (required by AppSync Events)
    const formattedChannel = channel.startsWith('/') ? channel : `/${channel}`;
    
    // Store the mapping between subscription ID and channel
    this.subscriptionIdToChannel.set(subscriptionId, channel);
    
    const httpUrl = new URL(this.url);
    const subscribeMessage = {
      type: 'subscribe',
      id: subscriptionId,
      channel: formattedChannel,
      authorization: {
        host: httpUrl.host,
        'x-api-key': this.apiKey
      }
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log(`[AppSync Events] Sent subscribe message for channel: ${formattedChannel} (id: ${subscriptionId})`);
  }

  /**
   * Send unsubscribe message to WebSocket
   * Note: We need to track subscription IDs to properly unsubscribe
   * For now, we'll just close and reconnect if needed
   */
  private sendUnsubscribeMessage(channel: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // TODO: Track subscription IDs to properly unsubscribe
    // For now, just log that we're removing the subscription locally
    console.log(`[AppSync Events] Removed local subscription for channel: ${channel}`);
  }

  /**
   * Subscribe to a channel for real-time events
   * 
   * @param channel - Channel name (e.g., "orders/{orderId}", "barista/queue", "attendee/{attendeeId}")
   * @param callback - Function to call when events are received
   * @returns Unsubscribe function
   */
  subscribe(channel: string, callback: EventCallback): () => void {
    // Add subscription to map
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, []);
    }

    const subscription: Subscription = { channel, callback };
    this.subscriptions.get(channel)!.push(subscription);

    // Send subscribe message if connected
    if (this.connectionState === ConnectionState.CONNECTED) {
      this.sendSubscribeMessage(channel);
    }

    console.log(`[AppSync Events] Added subscription to ${channel}`);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(channel, callback);
    };
  }

  /**
   * Unsubscribe from a channel
   * 
   * @param channel - Channel name
   * @param callback - Callback function to remove (optional, removes all if not provided)
   */
  unsubscribe(channel: string, callback?: EventCallback): void {
    const channelSubscriptions = this.subscriptions.get(channel);
    
    if (!channelSubscriptions) {
      return;
    }

    if (callback) {
      // Remove specific callback
      const index = channelSubscriptions.findIndex(sub => sub.callback === callback);
      if (index !== -1) {
        channelSubscriptions.splice(index, 1);
      }
    } else {
      // Remove all callbacks for this channel
      channelSubscriptions.length = 0;
    }

    // If no more subscriptions for this channel, unsubscribe from WebSocket
    if (channelSubscriptions.length === 0) {
      this.subscriptions.delete(channel);
      this.sendUnsubscribeMessage(channel);
      console.log(`[AppSync Events] Removed all subscriptions from ${channel}`);
    }
  }

  /**
   * Disconnect from WebSocket
   * Closes the connection and cleans up resources
   */
  disconnect(): void {
    console.log('[AppSync Events] Disconnecting...');
    
    this.shouldReconnect = false;
    this.stopHeartbeat();

    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }

    if (this.ws) {
      // Unsubscribe from all channels before closing
      this.subscriptions.forEach((_, channel) => {
        this.sendUnsubscribeMessage(channel);
      });

      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.subscriptions.clear();
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.reconnectionAttempts = 0;
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Get number of active subscriptions
   */
  getSubscriptionCount(): number {
    let count = 0;
    this.subscriptions.forEach(subs => {
      count += subs.length;
    });
    return count;
  }

  /**
   * Update reconnection configuration
   */
  setReconnectionConfig(config: Partial<ReconnectionConfig>): void {
    this.reconnectionConfig = {
      ...this.reconnectionConfig,
      ...config
    };
  }

  /**
   * Get current reconnection configuration
   */
  getReconnectionConfig(): ReconnectionConfig {
    return { ...this.reconnectionConfig };
  }
}

// Export singleton instance
export const appSyncEventsService = new AppSyncEventsService();

// Export class for testing purposes
export { AppSyncEventsService };

// Export convenience functions for direct usage
export const connectToEvents = () => appSyncEventsService.connect();
export const disconnectFromEvents = () => appSyncEventsService.disconnect();
export const subscribeToChannel = (channel: string, callback: EventCallback) => 
  appSyncEventsService.subscribe(channel, callback);
export const unsubscribeFromChannel = (channel: string, callback?: EventCallback) => 
  appSyncEventsService.unsubscribe(channel, callback);
export const getConnectionState = () => appSyncEventsService.getConnectionState();
export const isConnected = () => appSyncEventsService.isConnected();
