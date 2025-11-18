# Barista Components

This directory contains Vue components for the barista dashboard interface.

## Components

### OrderQueue.vue
Grid layout component for displaying pending orders. Features:
- Multi-column responsive grid (3-4 columns on desktop)
- Filter controls for drink type, size, and status
- Search functionality by order ID or attendee ID
- Real-time updates via AppSync Events

### OrderCard.vue
Individual order card component displaying:
- Order summary (drink type, size, customizations)
- Attendee ID and time since order placed
- Action buttons (Accept, Complete, Cancel)
- Visual status indicators

### OrderDetails.vue
Detailed order information modal/panel showing:
- Complete order information
- Customization list
- Action history timeline
- Notes field for barista comments

## Real-Time Integration

The barista view integrates with AppSync Events for real-time order updates:

### Channel Subscriptions

1. **Barista Queue Channel** (`barista/queue`)
   - Receives all new orders when they enter the queue
   - Triggers sound notification for new orders
   - Automatically subscribes to individual order channels

2. **Individual Order Channels** (`orders/{orderId}`)
   - Receives status updates for specific orders
   - Notifies when orders are accepted by other baristas
   - Notifies when orders are completed or cancelled
   - Automatically unsubscribes when order is finished

### Event Handling

The barista view handles the following events:

- `ORDER_QUEUED`: New order added to queue
  - Plays notification sound
  - Subscribes to order channel for updates
  - Adds order to pending orders list

- `ORDER_ACCEPTED`: Order accepted by a barista
  - Updates order status to "In Progress"
  - Moves order card to accepted section

- `ORDER_COMPLETED`: Order marked as complete
  - Removes order from queue with fade-out animation
  - Moves order to history
  - Unsubscribes from order channel

- `ORDER_CANCELLED`: Order cancelled
  - Removes order from queue with slide-out animation
  - Moves order to history
  - Unsubscribes from order channel

### Implementation Details

The AppSync Events integration is implemented in `BaristaView.vue`:

```typescript
// Initialize connection on mount
async function initializeAppSyncEvents() {
  await appSyncEventsService.connect();
  subscribeToBaristaQueue();
  subscribeToExistingOrders();
}

// Subscribe to barista queue for new orders
function subscribeToBaristaQueue() {
  appSyncEventsService.subscribe('barista/queue', (event) => {
    handleOrderEvent(event);
    if (event.type === 'ORDER_QUEUED') {
      playNotificationSound();
      subscribeToOrderChannel(event.orderId);
    }
  });
}

// Subscribe to individual order for status updates
function subscribeToOrderChannel(orderId: string) {
  appSyncEventsService.subscribe(`orders/${orderId}`, (event) => {
    handleOrderEvent(event);
    if (event.type === 'ORDER_COMPLETED' || event.type === 'ORDER_CANCELLED') {
      // Auto-unsubscribe when order is finished
      unsubscribe();
    }
  });
}

// Subscribe to existing orders on initialization
function subscribeToExistingOrders() {
  pendingOrders.value.forEach(order => {
    subscribeToOrderChannel(order.orderId);
  });
}
```

### Cleanup

All subscriptions are properly cleaned up when the component unmounts:

```typescript
onUnmounted(() => {
  cleanupAppSyncEvents();
});

function cleanupAppSyncEvents() {
  unsubscribeCallbacks.value.forEach(unsubscribe => unsubscribe());
  appSyncEventsService.disconnect();
}
```

## State Management

Order state is managed through the Pinia order store (`stores/orderStore.ts`):

- `pendingOrders`: All orders in QUEUED or ACCEPTED status
- `orderHistory`: Completed and cancelled orders
- `updateOrderStatus()`: Updates order status based on events
- `acceptOrder()`: Barista accepts an order
- `completeOrder()`: Barista marks order as complete
- `cancelOrder()`: Cancel an order with reason

## UI Features

### Filters
- Search by order ID or attendee ID
- Filter by drink type (latte, cappuccino, espresso, americano)
- Filter by size (small, medium, large)
- Filter by status (queued, in progress)

### Statistics Sidebar
- Orders completed today
- Average completion time
- Current queue length
- Active orders count

### Animations
- New orders: Slide in from top with pulse effect
- Accept: Card moves to "In Progress" section
- Complete: Fade out with success indicator
- Cancel: Slide out with error indicator

## Development Notes

### AppSync Events Configuration

Set the following environment variables in `.env`:

```env
VITE_APPSYNC_EVENTS_URL=https://xxx.appsync-api.region.amazonaws.com/event
VITE_APPSYNC_EVENTS_API_KEY=da2-xxxxxxxxxxxxx
```

If not configured, the barista view will display a development mode message and disable real-time updates.

### Testing

To test the barista view:

1. Ensure AppSync Events is configured
2. Place orders from the attendee view
3. Verify orders appear in barista queue with sound notification
4. Accept an order and verify status updates
5. Complete an order and verify it's removed from queue
6. Test cancellation from both attendee and barista views

### Browser Compatibility

The barista view is optimized for desktop browsers:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

WebSocket support is required for real-time updates.
