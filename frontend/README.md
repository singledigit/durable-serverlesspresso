# Coffee Ordering System - Frontend

Vue.js frontend application for the AWS Durable Functions coffee ordering system demo.

## Tech Stack

- **Framework**: Vue 3 with Composition API
- **Build Tool**: Vite
- **Language**: TypeScript
- **State Management**: Pinia
- **Routing**: Vue Router
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Real-time**: AWS AppSync Events (WebSocket)

## Project Structure

```
src/
├── assets/           # Static assets
├── components/       # Vue components
│   ├── attendee/    # Attendee-specific components
│   ├── barista/     # Barista-specific components
│   └── shared/      # Shared components
├── views/           # Page-level components
├── stores/          # Pinia stores
├── services/        # API and WebSocket services
├── types/           # TypeScript type definitions
├── router/          # Vue Router configuration
├── App.vue          # Root component
├── main.ts          # Application entry point
└── style.css        # Global styles with Tailwind
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Access the application
# Attendee view: http://localhost:5173/attendee
# Barista view: http://localhost:5173/barista
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
VITE_API_BASE_URL=https://your-api-gateway-url
VITE_APPSYNC_EVENTS_URL=https://your-appsync-events-url
VITE_APPSYNC_EVENTS_API_KEY=your-api-key
VITE_EVENT_ID=your-event-id
```

## Features

### Attendee Screen (Mobile-Optimized)
- Place coffee orders with customizations
- Real-time order status updates
- Order history with daily limit tracking
- Touch-friendly interface
- Smooth animations and transitions

### Barista Screen (Desktop-Optimized)
- View order queue in grid layout
- Accept and complete orders
- Real-time queue updates
- Order filtering and search
- Statistics dashboard

## Color Scheme

Coffee-themed palette:
- **Primary (Coffee Brown)**: `#6F4E37`
- **Secondary (Latte)**: `#D4A574`
- **Accent (Cream)**: `#E8C4A0`
- **Success**: `#4CAF50`
- **Warning**: `#FF9800`
- **Error**: `#F44336`

## Implementation Status

- [x] Project setup and configuration
- [x] TypeScript types
- [x] Router configuration
- [x] Pinia stores (order and event)
- [x] API service structure
- [x] AppSync Events service structure
- [x] Basic view layouts
- [ ] Order form component (Task 25)
- [ ] Order status component (Task 26)
- [ ] Order history component (Task 27)
- [ ] Barista queue component (Task 31)
- [ ] Real-time WebSocket integration (Task 28, 34)
- [ ] Animations and visual feedback (Task 29, 35)

## Development Notes

- Components will be implemented incrementally following the task list
- API calls are currently mocked and will be connected in Task 20
- WebSocket connections will be implemented in Task 21
- Real-time updates will be integrated in Tasks 28 and 34
