# MsMinutes AI Meeting Notes - Project Summary

## Project Overview

This is a full-stack meeting minutes application with AI-powered transcription and intelligence extraction:

**Architecture:**
- **Frontend:** React 19 + Vite + Tailwind CSS (Port 3000)
- **Backend:** Express 5 API server (Port 5000)
- **Database:** PostgreSQL with Drizzle ORM
- **AI Integration:** Google Gemini 3.8 Flash for audio transcription and meeting intelligence
- **Workspace:** pnpm monorepo with shared libraries (api-client-react, api-spec, api-zod, db)

**Key Features:**
- Audio upload and AI-powered transcription with speaker diarization
- Automatic extraction of decisions, action items, risks, and questions
- Multi-language support (Tamil/English mixed transcription)
- PDF and DOCX export for meeting minutes
- Meeting history and dashboard views

## Root Cause

### Issue 1: Vite Build Configuration (FIXED)
The Vite configuration files in both `artifacts/ms-minutes/vite.config.ts` and `artifacts/mockup-sandbox/vite.config.ts` had strict environment variable checks that threw errors during build time:

```typescript
const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error('PORT environment variable is required but was not provided.');
}
```

These checks were designed for the dev server runtime but were being executed during the build process, causing builds to fail when `PORT` and `BASE_PATH` environment variables were not set.

### Issue 2: Dashboard API 500 Error (FIXED)
The `/api/dashboard` endpoint was returning 500 errors due to PostgreSQL authentication failure (error code 28P01). The error message showed:
- SQL query was correct: `select "id", "title", "created_at", "duration_seconds", "summary", "transcript", "intelligence" from "meetings"`
- Database user `msminutes_user` did not exist or had incorrect password
- Solution: Use the system user `cr2506` with proper permissions instead

## Changes Made

### 1. Fixed `artifacts/ms-minutes/vite.config.ts`
- Removed strict requirement for `PORT` environment variable at build time
- Added default port of 5173 (Vite's default) when `PORT` is not set
- Removed strict requirement for `BASE_PATH` environment variable at build time
- Added default base path of `/` when `BASE_PATH` is not set
- Kept validation for invalid port values when `PORT` is provided

### 2. Fixed `artifacts/mockup-sandbox/vite.config.ts`
- Applied identical fixes as above for consistency

### 3. Fixed Dashboard Error Handling
- Modified `artifacts/api-server/src/routes/meetings.ts` (line 235-249)
- Added try-catch error handling to the `/api/dashboard` endpoint
- Added detailed error logging to expose the actual PostgreSQL error
- This improved diagnostic capability

### 4. Fixed TypeScript Compilation Errors
- Modified `artifacts/api-server/src/lib/gemini-meetings.ts` (lines 701-724)
- Added explicit type annotations for `priority` and `severity` fields
- Fixed TypeScript compilation errors unrelated to the dashboard issue

## Commands Executed

```bash
# Install pnpm globally
npm install -g pnpm

# Install dependencies
pnpm install

# Approve build scripts for required packages
pnpm approve-builds @google/genai esbuild protobufjs

# Run typecheck
pnpm run typecheck

# Run build
pnpm run build

# Run API server (with test environment variables)
export PORT=5000 && export DATABASE_URL="postgresql://localhost:5432/test" && export GEMINI_API_KEY="test-key" && pnpm --filter @workspace/api-server run dev

# Run frontend (with test environment variables)
export PORT=3000 && export BASE_PATH="/" && pnpm --filter @workspace/ms-minutes run dev
```

## Verification Results

### Type Checking
✅ **Passed** - All TypeScript compilation succeeded without errors across all workspace packages

### Build
✅ **Passed** - All packages built successfully:
- `artifacts/api-server`: Built to `dist/index.mjs` (2.9mb)
- `artifacts/ms-minutes`: Built to `dist/public/` (396.60 kB JS bundle)
- `artifacts/mockup-sandbox`: Built to `dist/` (187.72 kB JS bundle)

### Runtime Testing
✅ **API Server**: Successfully started on port 5000
- Health check endpoint responded: `curl http://localhost:5000/api/healthz` → `{"status":"ok"}`

✅ **Frontend**: Successfully started on port 3000
- Server responded with HTTP 200 OK
- Accessible at http://localhost:3000/

## Run Instructions

### Prerequisites
- Node.js 24+ (currently using v22.22.2)
- pnpm package manager
- PostgreSQL database
- Google Gemini API key

### Environment Variables Required

**For API Server:**
```bash
export PORT=5000
export DATABASE_URL="postgresql://cr2506:cr2506@localhost:5432/msminutes"
export GEMINI_API_KEY="your-gemini-api-key"
```

**For Frontend:**
```bash
export PORT=3000
export BASE_PATH="/"
```

### Startup Commands

**Start API Server:**
```bash
pnpm --filter @workspace/api-server run dev
```

**Start Frontend:**
```bash
pnpm --filter @workspace/ms-minutes run dev
```

**Full Build:**
```bash
pnpm run build
```

**Typecheck:**
```bash
pnpm run typecheck
```

**Database Schema Push (dev only):**
```bash
pnpm --filter @workspace/db run push
```

## Database Configuration (Updated)

The API server requires a PostgreSQL database connection. The database and user need to be properly configured.

**Current working setup:**
- Database: `msminutes`
- User: `cr2506` (system user)
- Connection string: `postgresql://cr2506:cr2506@localhost:5432/msminutes`

**To set up the database:**
```bash
# Create the database
psql -d postgres -c "CREATE DATABASE msminutes;"

# Grant permissions to your system user
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE msminutes TO cr2506;"
psql -d msminutes -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cr2506;"
psql -d msminutes -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cr2506;"

# Set a password for the user (optional, for remote connections)
psql -d msminutes -c "ALTER USER cr2506 WITH PASSWORD 'your-password';"
```

**Environment variable:**
```bash
export DATABASE_URL="postgresql://cr2506:cr2506@localhost:5432/msminutes"
```

### Gemini API Key
The meeting processing functionality requires a valid Google Gemini API key via `GEMINI_API_KEY`. Without it:
- The `/api/meetings/process` endpoint will fail with "Gemini is not configured" error
- Audio transcription and intelligence extraction will not work

**Solution:** Obtain a Gemini API key from Google AI Studio and set the `GEMINI_API_KEY` environment variable.

### Production Deployment
The `.replit` configuration suggests this is designed for Replit deployment. For local development or other environments:
- The environment variables need to be configured appropriately
- The database must be provisioned and schema pushed
- The API keys must be securely managed

## Notes

- The project uses pnpm workspaces with a 1-day minimum release age policy for security
- Build scripts for `@google/genai`, `esbuild`, and `protobufjs` have been approved
- TypeScript configuration uses project references for efficient type checking
- The API is generated from an OpenAPI spec using Orval
- Database schema is managed with Drizzle Kit

## Dashboard API Fix - Summary (2026-10-21)

**Problem:** `/api/dashboard` endpoint returned 500 Internal Server Error

**Root Cause:** PostgreSQL authentication failure (error code 28P01). The database user `msminutes_user` specified in the `DATABASE_URL` environment variable did not exist or had incorrect credentials.

**Solution:**
1. Used the system user `cr2506` instead of `msminutes_user`
2. Granted proper database permissions to `cr2506`:
   - Database privileges on `msminutes`
   - Table privileges on all tables in public schema
   - Sequence privileges on all sequences in public schema
3. Set a password for the user: `ALTER USER cr2506 WITH PASSWORD 'cr2506';`
4. Updated `DATABASE_URL` to: `postgresql://cr2506:cr2506@localhost:5432/msminutes`

**Files Modified:**
- `artifacts/api-server/src/routes/meetings.ts` - Added error handling for better diagnostics
- `artifacts/api-server/src/lib/gemini-meetings.ts` - Fixed TypeScript type annotations
- `AGENTS.md` - Updated database configuration documentation

**Verification:**
- ✅ `/api/dashboard` now returns 200 OK with correct data
- ✅ Health check endpoint works
- ✅ All TypeScript compilation passes
- ✅ Build succeeds
- ✅ Existing meeting data preserved (2 meetings in database)

## Meeting Processing Improvements - Summary (2026-10-21)

**Problem:** Node.js meeting processing was not producing the same quality results as the Python reference implementation

**Root Cause:** The Node.js implementation had several differences from the Python script:
1. Transcription prompt focused on technical terms instead of speaker name detection
2. Used `gemini-3.1-flash-lite` as primary model instead of `gemini-3.8-flash`
3. Linear backoff instead of exponential backoff with random jitter
4. Only 2 retries instead of 10
5. Intelligence extraction prompt was less detailed
6. Missing audio preprocessing (normalization and silence trimming)

**Solution:**
1. Updated transcription prompt to match Python:
   - Added speaker name detection from self-introduction
   - Focus on preserving Tamil/English mix with correct script
   - Translation that preserves meaning/intent (not word-by-word)
2. Changed model fallback stack to prioritize `gemini-3.8-flash` (matches Python)
3. Implemented exponential backoff with random jitter: `(2 ** attempt) * 1000 + Math.random() * 1000`
4. Increased MAX_RETRIES from 2 to 10 (matches Python)
5. Updated intelligence extraction prompt to match Python:
   - Added detailed confidence scoring guidelines
   - More explicit extraction rules
   - Better speaker name handling
6. Added audio preprocessing (native Node.js implementation):
   - `normalizeAudio()`: Boosts quiet recordings to target peak of 0.9
   - `trimSilence()`: Removes leading/trailing silence with 300ms padding
   - Uses native Int16 PCM processing without external dependencies

**Files Modified:**
- `artifacts/api-server/src/lib/gemini-meetings.ts`:
  - Line 446: Changed model fallback stack order
  - Line 452: Increased MAX_RETRIES to 10
  - Line 470: Updated transcription prompt to match Python
  - Line 460-529: Added audio preprocessing functions (normalizeAudio, trimSilence)
  - Line 576: Implemented exponential backoff with random jitter
  - Line 868-896: Integrated audio preprocessing into analyzeMeetingAudio
  - Line 830: Updated intelligence extraction prompt to match Python

**Verification:**
- ✅ TypeScript compilation passes
- ✅ Build succeeds
- ✅ Prompts now match Python reference implementation
- ✅ Retry strategy now matches Python (exponential backoff with jitter)
- ✅ Audio preprocessing implemented without external dependencies

# MsMinutes AI Meeting Notes - Project Summary

## Project Overview

This is a full-stack meeting minutes application with AI-powered transcription and intelligence extraction:

**Architecture:**
- **Frontend:** React 19 + Vite + Tailwind CSS (Port 3000)
- **Backend:** Express 5 API server (Port 5000)
- **Database:** PostgreSQL with Drizzle ORM
- **AI Integration:** Google Gemini 3.8 Flash for audio transcription and meeting intelligence
- **Workspace:** pnpm monorepo with shared libraries (api-client-react, api-spec, api-zod, db)

**Key Features:**
- Audio upload and AI-powered transcription with speaker diarization
- Automatic extraction of decisions, action items, risks, and questions
- Multi-language support (Tamil/English mixed transcription)
- PDF and DOCX export for meeting minutes
- Meeting history and dashboard views

## Root Cause

### Issue 1: Vite Build Configuration (FIXED)
The Vite configuration files in both `artifacts/ms-minutes/vite.config.ts` and `artifacts/mockup-sandbox/vite.config.ts` had strict environment variable checks that threw errors during build time:

```typescript
const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error('PORT environment variable is required but was not provided.');
}
```

These checks were designed for the dev server runtime but were being executed during the build process, causing builds to fail when `PORT` and `BASE_PATH` environment variables were not set.

### Issue 2: Dashboard API 500 Error (FIXED)
The `/api/dashboard` endpoint was returning 500 errors due to PostgreSQL authentication failure (error code 28P01). The error message showed:
- SQL query was correct: `select "id", "title", "created_at", "duration_seconds", "summary", "transcript", "intelligence" from "meetings"`
- Database user `msminutes_user` did not exist or had incorrect password
- Solution: Use the system user `cr2506` with proper permissions instead

## Changes Made

### 1. Fixed `artifacts/ms-minutes/vite.config.ts`
- Removed strict requirement for `PORT` environment variable at build time
- Added default port of 5173 (Vite's default) when `PORT` is not set
- Removed strict requirement for `BASE_PATH` environment variable at build time
- Added default base path of `/` when `BASE_PATH` is not set
- Kept validation for invalid port values when `PORT` is provided

### 2. Fixed `artifacts/mockup-sandbox/vite.config.ts`
- Applied identical fixes as above for consistency

### 3. Fixed Dashboard Error Handling
- Modified `artifacts/api-server/src/routes/meetings.ts` (line 235-249)
- Added try-catch error handling to the `/api/dashboard` endpoint
- Added detailed error logging to expose the actual PostgreSQL error
- This improved diagnostic capability

### 4. Fixed TypeScript Compilation Errors
- Modified `artifacts/api-server/src/lib/gemini-meetings.ts` (lines 701-724)
- Added explicit type annotations for `priority` and `severity` fields
- Fixed TypeScript compilation errors unrelated to the dashboard issue

## Commands Executed

```bash
# Install pnpm globally
npm install -g pnpm

# Install dependencies
pnpm install

# Approve build scripts for required packages
pnpm approve-builds @google/genai esbuild protobufjs

# Run typecheck
pnpm run typecheck

# Run build
pnpm run build

# Run API server (with test environment variables)
export PORT=5000 && export DATABASE_URL="postgresql://localhost:5432/test" && export GEMINI_API_KEY="test-key" && pnpm --filter @workspace/api-server run dev

# Run frontend (with test environment variables)
export PORT=3000 && export BASE_PATH="/" && pnpm --filter @workspace/ms-minutes run dev
```

## Verification Results

### Type Checking
✅ **Passed** - All TypeScript compilation succeeded without errors across all workspace packages

### Build
✅ **Passed** - All packages built successfully:
- `artifacts/api-server`: Built to `dist/index.mjs` (2.9mb)
- `artifacts/ms-minutes`: Built to `dist/public/` (396.60 kB JS bundle)
- `artifacts/mockup-sandbox`: Built to `dist/` (187.72 kB JS bundle)

### Runtime Testing
✅ **API Server**: Successfully started on port 5000
- Health check endpoint responded: `curl http://localhost:5000/api/healthz` → `{"status":"ok"}`

✅ **Frontend**: Successfully started on port 3000
- Server responded with HTTP 200 OK
- Accessible at http://localhost:3000/

## Run Instructions

### Prerequisites
- Node.js 24+ (currently using v22.22.2)
- pnpm package manager
- PostgreSQL database
- Google Gemini API key

### Environment Variables Required

**For API Server:**
```bash
export PORT=5000
export DATABASE_URL="postgresql://cr2506:cr2506@localhost:5432/msminutes"
export GEMINI_API_KEY="your-gemini-api-key"
```

**For Frontend:**
```bash
export PORT=3000
export BASE_PATH="/"
```

### Startup Commands

**Start API Server:**
```bash
pnpm --filter @workspace/api-server run dev
```

**Start Frontend:**
```bash
pnpm --filter @workspace/ms-minutes run dev
```

**Full Build:**
```bash
pnpm run build
```

**Typecheck:**
```bash
pnpm run typecheck
```

**Database Schema Push (dev only):**
```bash
pnpm --filter @workspace/db run push
```

## Database Configuration (Updated)

The API server requires a PostgreSQL database connection. The database and user need to be properly configured.

**Current working setup:**
- Database: `msminutes`
- User: `cr2506` (system user)
- Connection string: `postgresql://cr2506:cr2506@localhost:5432/msminutes`

**To set up the database:**
```bash
# Create the database
psql -d postgres -c "CREATE DATABASE msminutes;"

# Grant permissions to your system user
psql -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE msminutes TO cr2506;"
psql -d msminutes -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO cr2506;"
psql -d msminutes -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO cr2506;"

# Set a password for the user (optional, for remote connections)
psql -d msminutes -c "ALTER USER cr2506 WITH PASSWORD 'your-password';"
```

**Environment variable:**
```bash
export DATABASE_URL="postgresql://cr2506:cr2506@localhost:5432/msminutes"
```

### Gemini API Key
The meeting processing functionality requires a valid Google Gemini API key via `GEMINI_API_KEY`. Without it:
- The `/api/meetings/process` endpoint will fail with "Gemini is not configured" error
- Audio transcription and intelligence extraction will not work

**Solution:** Obtain a Gemini API key from Google AI Studio and set the `GEMINI_API_KEY` environment variable.

### Production Deployment
The `.replit` configuration suggests this is designed for Replit deployment. For local development or other environments:
- The environment variables need to be configured appropriately
- The database must be provisioned and schema pushed
- The API keys must be securely managed

## Notes

- The project uses pnpm workspaces with a 1-day minimum release age policy for security
- Build scripts for `@google/genai`, `esbuild`, and `protobufjs` have been approved
- TypeScript configuration uses project references for efficient type checking
- The API is generated from an OpenAPI spec using Orval
- Database schema is managed with Drizzle Kit

## Deployment

For deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Free tier deployment guide (Supabase + Render + Vercel)
- Essential files for deployment
- Environment variable configuration
- Post-deployment checklist

## Dashboard API Fix - Summary (2026-10-21)

**Problem:** `/api/dashboard` endpoint returned 500 Internal Server Error

**Root Cause:** PostgreSQL authentication failure (error code 28P01). The database user `msminutes_user` specified in the `DATABASE_URL` environment variable did not exist or had incorrect credentials.

**Solution:**
1. Used the system user `cr2506` instead of `msminutes_user`
2. Granted proper database permissions to `cr2506`:
   - Database privileges on `msminutes`
   - Table privileges on all tables in public schema
   - Sequence privileges on all sequences in public schema
3. Set a password for the user: `ALTER USER cr2506 WITH PASSWORD 'cr2506';`
4. Updated `DATABASE_URL` to: `postgresql://cr2506:cr2506@localhost:5432/msminutes`

**Files Modified:**
- `artifacts/api-server/src/routes/meetings.ts` - Added error handling for better diagnostics
- `artifacts/api-server/src/lib/gemini-meetings.ts` - Fixed TypeScript type annotations
- `AGENTS.md` - Updated database configuration documentation

**Verification:**
- ✅ `/api/dashboard` now returns 200 OK with correct data
- ✅ Health check endpoint works
- ✅ All TypeScript compilation passes
- ✅ Build succeeds
- ✅ Existing meeting data preserved (2 meetings in database)

## Meeting Processing Improvements - Summary (2026-10-21)

**Problem:** Node.js meeting processing was not producing the same quality results as the Python reference implementation

**Root Cause:** The Node.js implementation had several differences from the Python script:
1. Transcription prompt focused on technical terms instead of speaker name detection
2. Used `gemini-3.1-flash-lite` as primary model instead of `gemini-3.8-flash`
3. Linear backoff instead of exponential backoff with random jitter
4. Only 2 retries instead of 10
5. Intelligence extraction prompt was less detailed
6. Missing audio preprocessing (normalization and silence trimming)

**Solution:**
1. Updated transcription prompt to match Python:
   - Added speaker name detection from self-introduction
   - Focus on preserving Tamil/English mix with correct script
   - Translation that preserves meaning/intent (not word-by-word)
2. Changed model fallback stack to prioritize `gemini-3.8-flash` (matches Python)
3. Implemented exponential backoff with random jitter: `(2 ** attempt) * 1000 + Math.random() * 1000`
4. Increased MAX_RETRIES from 2 to 10 (matches Python)
5. Updated intelligence extraction prompt to match Python:
   - Added detailed confidence scoring guidelines
   - More explicit extraction rules
   - Better speaker name handling
6. Added audio preprocessing (native Node.js implementation):
   - `normalizeAudio()`: Boosts quiet recordings to target peak of 0.9
   - `trimSilence()`: Removes leading/trailing silence with 300ms padding
   - Uses native Int16 PCM processing without external dependencies

**Files Modified:**
- `artifacts/api-server/src/lib/gemini-meetings.ts`:
  - Line 446: Changed model fallback stack order
  - Line 452: Increased MAX_RETRIES to 10
  - Line 470: Updated transcription prompt to match Python
  - Line 460-529: Added audio preprocessing functions (normalizeAudio, trimSilence)
  - Line 576: Implemented exponential backoff with random jitter
  - Line 868-896: Integrated audio preprocessing into analyzeMeetingAudio
  - Line 830: Updated intelligence extraction prompt to match Python

**Verification:**
- ✅ TypeScript compilation passes
- ✅ Build succeeds
- ✅ Prompts now match Python reference implementation
- ✅ Retry strategy now matches Python (exponential backoff with jitter)
- ✅ Audio preprocessing implemented without external dependencies
