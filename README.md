# Snr-Dave AI Assistant

A Command Center dashboard featuring real-time AI chat, GitHub activity monitoring, and dynamic project portfolio. Built with a high-contrast Deep Charcoal and Electric Cyan aesthetic.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **AI Integration:** Vercel AI SDK 6 with Gemini 2.5 Flash
- **Styling:** Tailwind CSS 4
- **Data Fetching:** SWR for real-time updates
- **Icons:** Lucide React

## Features

### Real-time AI Chat
- Conversational AI assistant powered by Google Gemini 2.5 Flash
- Streaming responses with real-time typing indicators
- Error handling and connection status display
- Auto-scrolling message history

### GitHub Activity Feed
- Live feed of the last 10 GitHub events for Snr-Dave
- Auto-refreshes every 60 seconds
- Displays push events, pull requests, issues, stars, and more
- Relative timestamps and event-specific icons

### Dynamic Project Portfolio
- Fetches repositories directly from GitHub API
- Shows stars, forks, and primary language
- Filters out forked repositories
- Links to repository and live demo (if available)

### System Status Monitor
- Real-time health checks for API Gateway and AI Model
- GitHub API connectivity status
- Manual refresh button
- Auto-checks every 60 seconds

## Environment Variables

Create a `.env.local` file in the root directory or configure these in your Vercel project settings:

```bash
# No API keys required for basic functionality!
# The AI SDK uses the Vercel AI Gateway which provides 
# access to Gemini through Vercel's infrastructure.

# Optional: For custom AI provider configuration
# AI_GATEWAY_API_KEY=your_key_here
```

> **Note:** When deployed on Vercel, the AI Gateway provides zero-config access to Gemini. No API keys are required.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm, yarn, or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Snr-Dave/snr-dave-ai-assistant.git
   cd snr-dave-ai-assistant
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
snr-dave-ai-assistant/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── route.ts      # AI chat API endpoint
│   ├── globals.css           # Tailwind config & design tokens
│   ├── layout.tsx            # Root layout with fonts
│   └── page.tsx              # Main dashboard page
├── components/
│   ├── chat-window.tsx       # AI chat interface
│   ├── dashboard-header.tsx  # Navigation header
│   ├── github-feed.tsx       # GitHub activity feed
│   ├── projects-grid.tsx     # Dynamic project cards
│   └── system-status.tsx     # Health monitoring
└── lib/
    └── projects.ts           # Project type definitions
```

## Design System

### Colors

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#0f0f0f` | Deep Charcoal - primary background |
| Foreground | `#f5f5f5` | Primary text |
| Accent | `#00d9ff` | Electric Cyan - interactive elements |
| Card | `#171717` | Card backgrounds |
| Muted | `#262626` | Secondary backgrounds |

### Typography

- **Sans:** Geist Sans - UI elements and body text
- **Mono:** Geist Mono - Code and technical labels

## Deployment

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FSnr-Dave%2Fsnr-dave-ai-assistant)

1. Click the button above or import from GitHub
2. Vercel automatically detects Next.js and configures build settings
3. No environment variables needed for basic functionality
4. Your AI Assistant will be live in seconds

## API Endpoints

### POST /api/chat
Send messages to the AI assistant.

**Request:**
```json
{
  "messages": [
    { "role": "user", "parts": [{ "type": "text", "text": "Hello!" }] }
  ]
}
```

**Response:** Server-sent events stream with AI responses.

### GET /api/chat
Health check endpoint for system status monitoring.

**Response:**
```json
{
  "status": "ok",
  "model": "google/gemini-2.5-flash"
}
```

## License

MIT License - feel free to use this project as a starting point for your own AI assistant dashboard.

## Author

**Snr-Dave** - [GitHub](https://github.com/Snr-Dave)
