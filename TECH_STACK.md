# MsMinutes AI Meeting Notes - Tech Stack & External APIs

## Project Overview

MsMinutes is a full-stack AI-powered meeting minutes application that transcribes audio, extracts intelligence, and generates actionable meeting summaries.

**Architecture:** Monorepo with pnpm workspaces
**License:** MIT
**Type:** Private project

---

## Workspace Configuration

### Package Manager
- **pnpm** - Fast, disk space efficient package manager
- **Minimum Release Age:** 1440 minutes (1 day) for security (supply-chain attack defense)
- **Workspace Packages:**
  - `artifacts/*` - Main application packages
  - `lib/*` - Shared workspace libraries
  - `scripts` - Build and deployment scripts

---

## Frontend (ms-minutes)

### Core Framework
- **React:** 19.1.0 (exact version pinned for Expo compatibility)
- **TypeScript:** ~5.9.3
- **Vite:** 7.3.2
- **Wouter:** 3.3.5 (lightweight React router)

### Build Tools
- **@vitejs/plugin-react:** 5.0.4
- **@replit/vite-plugin-cartographer:** 0.5.21
- **@replit/vite-plugin-dev-banner:** 0.1.1
- **@replit/vite-plugin-runtime-error-modal:** 0.0.6
- **@tailwindcss/vite:** 4.1.14

### Styling
- **Tailwind CSS:** 4.1.14
- **@tailwindcss/typography:** 0.5.15
- **Framer Motion:** 12.23.24 (animations)
- **tailwind-merge:** 3.3.1
- **clsx:** 2.1.1
- **class-variance-authority:** 0.7.1
- **tw-animate-css:** 1.4.0

### UI Components (Radix UI)
- **@radix-ui/react-accordion:** 1.2.4
- **@radix-ui/react-alert-dialog:** 1.1.7
- **@radix-ui/react-aspect-ratio:** 1.1.3
- **@radix-ui/react-avatar:** 1.1.4
- **@radix-ui/react-checkbox:** 1.1.5
- **@radix-ui/react-collapsible:** 1.1.4
- **@radix-ui/react-context-menu:** 2.2.7
- **@radix-ui/react-dialog:** 1.1.7
- **@radix-ui/react-dropdown-menu:** 2.1.7
- **@radix-ui/react-hover-card:** 1.1.7
- **@radix-ui/react-label:** 2.1.3
- **@radix-ui/react-menubar:** 1.1.7
- **@radix-ui/react-navigation-menu:** 1.2.6
- **@radix-ui/react-popover:** 1.1.7
- **@radix-ui/react-progress:** 1.1.3
- **@radix-ui/react-radio-group:** 1.2.4
- **@radix-ui/react-scroll-area:** 1.2.4
- **@radix-ui/react-select:** 2.1.7
- **@radix-ui/react-separator:** 1.1.3
- **@radix-ui/react-slider:** 1.2.4
- **@radix-ui/react-slot:** 1.2.0
- **@radix-ui/react-switch:** 1.1.4
- **@radix-ui/react-tabs:** 1.1.4
- **@radix-ui/react-toast:** 1.2.7
- **@radix-ui/react-toggle:** 1.1.3
- **@radix-ui/react-toggle-group:** 1.1.3
- **@radix-ui/react-tooltip:** 1.2.0

### State Management & Data Fetching
- **@tanstack/react-query:** 5.90.21 (TanStack Query for server state)
- **zod:** 3.25.76 (runtime type validation)

### Form Handling
- **react-hook-form:** 7.55.0
- **@hookform/resolvers:** 3.10.0

### Icons
- **lucide-react:** 0.545.0
- **react-icons:** 5.4.0

### Utilities
- **date-fns:** 3.6.0 (date manipulation)
- **next-themes:** 0.4.6 (dark mode support)
- **cmdk:** 1.1.1 (command palette)
- **embla-carousel-react:** 8.6.0 (carousel)
- **input-otp:** 1.4.2 (one-time password input)
- **react-day-picker:** 9.11.1 (date picker)
- **react-resizable-panels:** 2.1.7 (resizable panels)
- **recharts:** 2.15.2 (charts)
- **sonner:** 2.0.7 (toast notifications)
- **vaul:** 1.1.2 (drawer/sheet)

### Authentication
- **@supabase/supabase-js:** 2.118.0

### Type Definitions
- **@types/node:** 25.3.3
- **@types/react:** 19.2.0
- **@types/react-dom:** 19.2.0

---

## Backend (api-server)

### Core Framework
- **Express:** 5.2.1
- **TypeScript:** ~5.9.3
- **Node.js:** 24+ (currently using v22.22.2)

### Build Tool
- **esbuild:** 0.28.2 (fast JavaScript bundler)
- **esbuild-plugin-pino:** 2.3.3 (Pino logger integration)

### Database & ORM
- **Drizzle ORM:** 0.45.2
- **PostgreSQL (pg):** 8.23.0
- **drizzle-zod:** 0.8.3

### AI Services
- **@google/genai:** 2.29.0 (Google Gemini AI SDK)
- **groq-sdk:** 1.6.0 (Groq AI SDK - if used for alternative AI)

### Authentication & Storage
- **@supabase/supabase-js:** 2.118.0
- **cookie-parser:** 1.4.7
- **cors:** 2.8.6

### Audio Processing
- **fluent-ffmpeg:** 2.1.3 (FFmpeg wrapper for audio compression)
- **music-metadata:** 12.2.0 (audio metadata extraction)
- **multer:** 2.4.0 (multipart/form-data handling for file uploads)

### Document Generation
- **docx:** 9.10.0 (DOCX file generation)
- **pdfkit:** 0.20.2 (PDF file generation)

### Logging
- **pino:** 9.14.0 (fast JSON logger)
- **pino-http:** 10.5.0 (HTTP request logging)
- **pino-pretty:** 13.1.3 (pretty print logs for development)
- **thread-stream:** 3.1.0 (worker thread for logging)

### Utilities
- **@swc/helpers:** 0.5.23 (SWC helper functions)
- **dotenv:** 18.0.9 (environment variable loading)

### Type Definitions
- **@types/express:** 5.0.6
- **@types/cookie-parser:** 1.4.10
- **@types/cors:** 2.8.19
- **@types/fluent-ffmpeg:** 2.1.28
- **@types/multer:** 2.3.0
- **@types/node:** 25.3.3
- **@types/pdfkit:** 0.17.6

---

## Shared Libraries

### Database Layer (lib/db)
- **drizzle-orm:** 0.45.2
- **drizzle-zod:** 0.8.3
- **pg:** 8.23.0
- **zod:** 3.25.76
- **drizzle-kit:** 0.31.10 (migration tool)

### API Specification (lib/api-spec)
- **orval:** (OpenAPI to TypeScript code generator)

### API Validation (lib/api-zod)
- **zod:** 3.25.76

### API Client (lib/api-client-react)
- **@tanstack/react-query:** 5.90.21
- **zod:** 3.25.76

---

## External APIs & Services

### 1. Supabase
**Purpose:** Database, Authentication, Storage

**Services Used:**
- **PostgreSQL Database:** Meeting data storage with Row Level Security (RLS)
- **Supabase Auth:** User authentication with email/password and OAuth
- **Supabase Storage:** Audio file storage (compressed MP3 files)
- **Real-time Subscriptions:** (if implemented for live updates)

**Configuration:**
- Project URL: `https://kvjzxuwskwpwkolqicoq.supabase.co`
- Publishable Key: Used in frontend
- Service Role Key: Used in backend for admin operations
- Storage Bucket: `meeting-audio` (50MB limit, with compression)

**Features:**
- Email verification with configurable redirect URLs
- JWT token-based authentication
- Signed URLs for secure file access (24-hour expiry)
- Automatic cleanup of old audio files (30-day retention)

### 2. Google Gemini AI
**Purpose:** Audio transcription, translation, and meeting intelligence extraction

**Services Used:**
- **Gemini 3.8 Flash:** Primary model for transcription and intelligence
- **Gemini 3.1 Flash Lite:** Fallback model (if needed)

**Configuration:**
- API Key: Required for `GEMINI_API_KEY` environment variable
- Model: `gemini-3.8-flash` (preferred)
- Alternative Models: `gemini-3.1-flash-lite`, `gemini-2.5-pro`

**Features:**
- Multi-language transcription (Tamil/English mixed)
- Speaker diarization (identifying different speakers)
- Meeting intelligence extraction:
  - Summary generation
  - Action items with priorities
  - Decisions made
  - Risks identified
  - Questions and answers
- Confidence scoring for all extracted entities
- Audio preprocessing (normalization, silence trimming)
- Exponential backoff with random jitter for retries (up to 10 attempts)

### 3. FFmpeg (System Dependency)
**Purpose:** Audio compression and processing

**Configuration:**
- Sample Rate: 16kHz (optimal for speech)
- Channels: Mono (speech doesn't need stereo)
- Bitrate: VBR quality 4 (~65-85 kbps average)
- Format: MP3 (universal compatibility)
- Compression Ratio: 85-90% file size reduction

**Features:**
- Automatic audio compression before storage
- Preserves original quality for AI transcription
- Compressed version for playback/storage
- Graceful fallback if compression fails

---

## Development Tools

### Code Quality
- **Prettier:** 3.9.6 (code formatting)
- **TypeScript:** 5.9.3 (static type checking)
- **ESLint:** (if configured)

### Package Management
- **pnpm:** Workspace monorepo support
- **Security:** 1-day minimum release age for npm packages

### Build & Development
- **esbuild:** Fast bundling for backend
- **Vite:** Fast HMR for frontend development
- **tsx:** TypeScript execution helper

---

## Deployment Platforms

### Frontend
- **Vercel:** Primary deployment platform
  - Free tier: 100GB bandwidth/month
  - Automatic HTTPS
  - Global CDN
  - Environment variables: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_URL`

### Backend
- **Render:** Primary deployment platform
  - Free tier: 512MB RAM, 0.1 CPU
  - Sleeps after 15min inactivity
  - Environment variables: `PORT`, `DATABASE_URL`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`

### Database
- **Supabase:** PostgreSQL hosting
  - Free tier: 500MB storage
  - Built-in authentication
  - 60-second connection limit
  - Environment variables: `DATABASE_URL`

---

## Architecture Patterns

### Monorepo Structure
```
MsMinutes-AI-Meeting-Notes/
├── artifacts/
│   ├── api-server/          # Express backend
│   └── ms-minutes/          # React frontend
├── lib/
│   ├── api-client-react/    # Generated React API client
│   ├── api-spec/            # OpenAPI specification
│   ├── api-zod/             # Generated Zod schemas
│   └── db/                  # Drizzle ORM & database schema
└── scripts/                 # Deployment scripts
```

### API Generation
- **Orval:** Generates React hooks and types from OpenAPI spec
- **Zod:** Runtime validation schemas generated from Drizzle schema
- **Type Safety:** End-to-end type safety from database to frontend

### Security Features
- **Supply Chain Defense:** 1-day minimum release age for npm packages
- **Row Level Security:** PostgreSQL RLS on meetings table
- **Signed URLs:** Supabase Storage URLs expire in 24 hours
- **JWT Authentication:** Supabase Auth with token validation
- **Audio Compression:** Reduces storage costs and attack surface

---

## Environment Variables

### Frontend (Vercel)
```bash
VITE_API_URL=https://your-backend.onrender.com
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_APP_URL=https://msminutes-ai-meeting-notes.vercel.app
```

### Backend (Render)
```bash
PORT=5000
DATABASE_URL=postgresql://user:password@host:port/database
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
AUDIO_MAX_FILES=20
AUDIO_RETENTION_DAYS=30
```

### Local Development
```bash
# Backend
PORT=5000
DATABASE_URL=postgresql://cr2506:cr2506@localhost:5432/msminutes
GEMINI_API_KEY=your-gemini-api-key

# Frontend
PORT=3000
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_APP_URL=http://localhost:3000
```

---

## Key Technical Decisions

### Why React 19?
- Latest React features (use(), actions, etc.)
- Pinned to exact version for Expo compatibility (if needed)

### Why Vite?
- Fast HMR for development
- Optimized production builds
- Excellent TypeScript support
- Ecosystem of plugins

### Why Drizzle ORM?
- Type-safe database queries
- Migration-first approach
- Excellent TypeScript integration
- Lightweight compared to Prisma

### Why Supabase?
- All-in-one platform (DB, Auth, Storage)
- Free tier for development
- Built-in RLS for security
- Real-time capabilities
- Easy to use dashboard

### Why Google Gemini?
- State-of-the-art AI model
- Multi-language support (Tamil/English)
- Speaker diarization
- Competitive pricing
- Fast inference

### Why FFmpeg?
- Industry standard for audio processing
- Compression without quality loss for speech
- Wide format support
- Can process streaming audio

---

## Performance Optimizations

### Frontend
- Code splitting with dynamic imports
- Lazy loading of routes
- TanStack Query caching
- Optimized bundle size (638KB gzipped)
- Image optimization (if implemented)

### Backend
- esbuild for fast bundling
- Audio compression (85-90% reduction)
- Automatic cleanup of old files
- Connection pooling with PostgreSQL
- Pino logger (fast JSON logging)

### Database
- Row Level Security for data isolation
- Indexed columns for query performance
- Connection pooling via Supabase pooler

---

## Known Limitations

1. **Render Sleep Mode:** Backend sleeps after 15min inactivity (free tier)
2. **Supabase Storage:** 50MB bucket limit (mitigated with compression)
3. **Gemini API:** Rate limits on free tier
4. **Audio Upload:** Original limit was 50MB (adjusted with compression)
5. **Email Verification:** Requires Supabase URL configuration

---

## Future Scalability

When free tier limits are exceeded:
1. **Render:** Upgrade to Starter ($7/month) - removes sleep mode
2. **Supabase:** Upgrade to Pro ($25/month) - 8GB storage
3. **Vercel:** Upgrade to Pro ($20/month) - 1TB bandwidth
4. **Gemini:** Upgrade to paid API tier for higher rate limits

---

## Last Updated

November 11, 2026

## Version Information

- Project Version: 0.0.0
- Current Branch: security-patches
- Latest Commit: Ahead of origin by 1 commit
