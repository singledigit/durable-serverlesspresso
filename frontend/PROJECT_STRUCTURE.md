# Frontend Project Structure

## Overview
Vue.js 3 + TypeScript + Vite frontend for the Coffee Ordering System

## Directory Structure

```
frontend/
├── src/
│   ├── assets/              # Static assets (images, icons)
│   ├── components/          # Vue components
│   │   ├── attendee/       # Attendee-specific components (Task 25-27)
│   │   ├── barista/        # Barista-specific components (Task 31-33)
│   │   └── shared/         # Shared/reusable components (Task 37)
│   ├── router/             # Vue Router configuration ✓
│   │   └── index.ts        # Route definitions
│   ├── services/           # External service integrations ✓
│   │   ├── api.ts          # REST API client (to be implemented in Task 20)
│   │   └── appSyncEvents.ts # WebSocket client (to be implemented in Task 21)
│   ├── stores/             # Pinia state management ✓
│   │   ├── orderStore.ts   # Order state and actions
│   │   └── eventStore.ts   # Event configuration state
│   ├── types/              # TypeScript type definitions ✓
│   │   └── index.ts        # All type exports
│   ├── views/              # Page-level components ✓
│   │   ├── AttendeeView.vue # Mobile-optimized attendee screen
│   │   └── BaristaView.vue  # Desktop-optimized barista dashboard
│   ├── App.vue             # Root component ✓
│   ├── main.ts             # Application entry point ✓
│   └── style.css           # Global styles with Tailwind ✓
├── .env                    # Environment variables (local)
├── .env.example            # Environment variables template
├── package.json            # Dependencies and scripts
├── postcss.config.js       # PostCSS configuration
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite build configuration
└── README.md               # Project documentation

## Completed (Task 18)

✅ Project initialization with Vite + Vue 3 + TypeScript
✅ Dependencies installed (vue-router, pinia, axios, tailwindcss)
✅ Tailwind CSS configured with coffee-themed colors
✅ TypeScript types defined
✅ Router configuration with attendee and barista routes
✅ Pinia stores created (order and event management)
✅ API service structure
✅ AppSync Events service structure
✅ Basic view layouts
✅ Environment variable templates
✅ Build verification successful

## Next Steps

- Task 19: Create additional TypeScript interfaces (if needed)
- Task 20: Implement API service methods
- Task 21: Implement AppSync Events WebSocket connection
- Task 22-23: Enhance Pinia stores with real API calls
- Task 24-29: Build attendee screen components
- Task 30-36: Build barista screen components
- Task 37-40: Shared components and optimizations

## Coffee Theme Colors

Defined in `src/style.css`:
- **Coffee Brown**: `#6F4E37` (Primary)
- **Latte**: `#D4A574` (Secondary)
- **Cream**: `#E8C4A0` (Accent)

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npm run type-check
```

## Notes

- All API calls are currently mocked and will be implemented in Task 20
- WebSocket connections are stubbed and will be implemented in Task 21
- Component placeholders are in place for future tasks
- Build is verified and working with TypeScript strict mode
