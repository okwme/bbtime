# Baby Time Tracker

A Progressive Web App (PWA) for tracking baby sleep and eating times. Designed for iPhone home screen use with offline support and persistent local storage.

## Features

- **Real-time Tracking**: Stopwatch-style interface that continuously tracks baby's state (sleeping, awake, or eating)
- **State Management**:
  - Toggle between sleeping and awake states
  - Track eating as a subset of awake time
  - All state changes are automatically saved
- **Visual Timeline**: Color-coded daily view showing activity blocks throughout each day
- **Editable Entries**: Click any activity to edit start/end times or delete
- **Offline Support**: Works without internet connection once installed
- **Persistent Storage**: All data stored locally on your device
- **Mobile-First Design**: Optimized for iPhone and mobile devices
- **PWA Installable**: Add to home screen for app-like experience

## Technology Stack

- Vue.js 3 with Composition API
- TypeScript for type safety
- Tailwind CSS 4 for styling
- Pinia for state management
- Vite for build tooling
- vite-plugin-pwa for PWA functionality

## Getting Started

### Prerequisites

- Node.js 20.19.0 or 22.12.0+
- npm

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Usage

### Development

The app will be available at `http://localhost:5173/` during development.

### Production Deployment

1. Build the app: `npm run build`
2. Deploy the `dist` folder to your hosting service
3. Ensure your server is configured for PWA:
   - Serve over HTTPS
   - Serve manifest.webmanifest with correct MIME type
   - Configure service worker caching

### Installing on iPhone

1. Open the app in Safari
2. Tap the Share button
3. Scroll down and tap "Add to Home Screen"
4. Name it "BabyTime" and tap Add
5. The app icon will appear on your home screen

## App Views

### Tracker View (Home)

- Large status circle showing current activity (sleeping, awake, or eating)
- Real-time elapsed time counter
- "Sleep" / "Wake Up" toggle button
- "Start Eating" / "Stop Eating" button (disabled during sleep)
- Color coding:
  - 🌙 Blue: Sleeping
  - ☀️ Amber: Awake
  - 🍼 Green: Eating

### Timeline View

- Daily activity cards showing all recorded activities
- Visual 24-hour timeline with color-coded blocks
- Detailed list of each activity with timestamps and duration
- Click any activity to edit or delete

### Cloud Sync View

- Create shareable rooms with 6-character codes (e.g., ABC-DEF)
- Join existing rooms to sync with other caregivers
- Auto-sync every 15 seconds
- Real-time room status display
- Copy room code to share easily

## Data Storage & Cloud Sync

### Local Storage (Always Active)

All data is stored in browser localStorage and persists across sessions. Data includes:

- All activity entries (type, start time, end time)
- Current activity state
- Current entry start time

**Note**: Clearing browser data will erase all tracked activities.

### Cloud Sync (Optional)

Cloud sync allows multiple devices to share the same baby tracking data using JSONBin.io.

**Setup:**

1. Get a free API key from [https://jsonbin.io/](https://jsonbin.io/)
2. Go to the Sync tab in the app
3. Enter your API key when prompted
4. Create a new room or join an existing one

**Features:**

- ✅ Data persists indefinitely (not automatically deleted)
- ✅ Free tier: 10,000 API requests
- ✅ Auto-sync every 15 seconds
- ✅ Smart merging (keeps all unique entries)
- ✅ Works offline - syncs when reconnected
- ✅ No authentication beyond simple room codes

**Alternative setup (for deployment):**

Copy `.env.example` to `.env` and add your API key:

```bash
cp .env.example .env
# Edit .env and add your JSONBin API key
```

## PWA Icons

To complete the PWA setup, add the following icon files to the `public` folder:

- `pwa-192x192.png` - 192x192px icon
- `pwa-512x512.png` - 512x512px icon
- `apple-touch-icon.png` - 180x180px icon for iOS
- `favicon.ico` - Standard favicon

## Development Notes

- The app uses Vue Router for navigation between Tracker and Timeline views
- Bottom navigation bar provides easy switching between views
- All times are stored as JavaScript Date objects
- The app automatically groups activities by day for timeline display

## License

MIT

## Credits

Built with Vue.js and Vite
