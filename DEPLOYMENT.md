# MsMinutes AI Meeting Notes - Deployment Guide (Free Tier)

## Essential Files for Deployment

### Required Files (Keep These)

```
MsMinutes-AI-Meeting-Notes/
├── package.json                    # Root package configuration
├── pnpm-workspace.yaml            # Workspace configuration
├── pnpm-lock.yaml                 # Dependency lock file
├── tsconfig.json                  # Root TypeScript config
├── tsconfig.base.json             # Base TypeScript config
├── .npmrc                         # pnpm configuration
│
├── lib/                           # Shared libraries
│   ├── db/                        # Database layer
│   │   ├── package.json
│   │   ├── drizzle.config.ts      # Drizzle ORM config
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── schema/
│   │   │       ├── index.ts
│   │   │       └── meetings.ts    # Database schema
│   │   └── drizzle/               # Migrations (keep these)
│   │       ├── 0000_lazy_retro_girl.sql
│   │       └── meta/
│   ├── api-spec/                   # API specification
│   │   └── package.json
│   ├── api-zod/                    # API validation schemas
│   │   └── package.json
│   └── api-client-react/           # API client for frontend
│       └── package.json
│
├── artifacts/
│   ├── api-server/                # Backend API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── build.mjs              # Build script
│   │   └── src/
│   │       ├── index.ts
│   │       ├── app.ts
│   │       ├── lib/
│   │       │   ├── logger.ts
│   │       │   ├── gemini-meetings.ts
│   │       │   └── meeting-documents.ts
│   │       └── routes/
│   │           └── meetings.ts
│   │
│   └── ms-minutes/               # Frontend React app
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── pages/
│           ├── components/
│           └── hooks/
```

### Files to Remove (Not Needed for Deployment)

```
❌ .agents/                    # Devin AI configuration
❌ .conversation/              # Chat history
❌ api-server.log              # Development logs
❌ frontend.log               # Development logs
❌ .replit                     # Replit-specific config
❌ .replitignore               # Replit-specific config
❌ replit.md                   # Replit documentation
❌ artifacts/mockup-sandbox/   # Development sandbox
```

### Files to Keep (New for Deployment)

```
✅ scripts/deploy-db.sh        # Database migration script (new)
✅ .env.example                # Environment variable template (new)
✅ DEPLOYMENT.md               # Deployment guide (new)
```

## Free Tier Deployment Options

### 1. Database: Supabase (Free Tier)

**Why Supabase:**
- Free PostgreSQL database with 500MB storage
- Built-in authentication
- Real-time subscriptions
- Easy to use dashboard
- 60-second connection time limit (perfect for this app)

**Setup Steps:**

1. Go to [supabase.com](https://supabase.com) and sign up
2. Create a new project
3. Get your database URL from Settings > Database
4. Run the schema migration:
   ```bash
   cd lib/db
   DATABASE_URL="your-supabase-url" pnpm exec drizzle-kit push --config ./drizzle.config.ts
   ```

### 2. Backend: Render (Free Tier)

**Why Render:**
- Free tier for web services
- Automatic HTTPS
- Easy deployment from GitHub
- 512MB RAM, 0.1 CPU (sufficient for this app)
- Sleeps after 15min inactivity (wakes on request)

**Setup Steps:**

1. Push code to GitHub
2. Go to [render.com](https://render.com) and sign up
3. Create a new "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Root Directory:** `artifacts/api-server`
   - **Build Command:** `cd ../.. && pnpm install && pnpm run build`
   - **Start Command:** `node dist/index.mjs`
   - **Environment Variables:** See below

### 3. Frontend: Vercel (Free Tier)

**Why Vercel:**
- Free tier for static sites & Node.js
- Automatic HTTPS
- Global CDN
- Easy deployment from GitHub
- 100GB bandwidth/month

**Setup Steps:**

1. Go to [vercel.com](https://vercel.com) and sign up
2. Create a new project
3. Connect your GitHub repository
4. Configure:
   - **Root Directory:** `artifacts/ms-minutes`
   - **Build Command:** `pnpm install && pnpm run build`
   - **Output Directory:** `dist/public`
   - **Environment Variables:** See below

## Environment Variables

### Backend (Render)

```bash
PORT=5000
DATABASE_URL=postgresql://[user]:[password]@[host]:[port]/[database]
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_PUBLISHABLE_KEY=[Supabase publishable key]
GEMINI_API_KEY=your-gemini-api-key
```

### Frontend (Vercel)

```bash
VITE_API_URL=https://your-backend.onrender.com
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[Supabase publishable key]
```

### For Development (Local)

```bash
PORT=5000
DATABASE_URL=postgresql://cr2506:cr2506@localhost:5432/msminutes
GEMINI_API_KEY=your-gemini-api-key
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_PUBLISHABLE_KEY=[Supabase publishable key]
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[Supabase publishable key]
```

In Supabase, enable email confirmations under **Authentication > Providers > Email** and add the Vercel production URL plus local development URL to **Authentication > URL Configuration**. Supabase Auth stores the account email and the submitted full name in its protected `auth.users` record; the application does not store passwords. The publishable key is intended for browser use. Never put a Supabase secret/service-role key in Vercel or frontend code.

The meetings migration adds an owner column and enables RLS policies. Existing meetings have no owner, so they remain inaccessible after sign-in until you explicitly assign them to the right account. Do not assign legacy meetings to a new user automatically.

## Deployment Steps

### Step 1: Clean Up Repository

```bash
cd "/home/cr2506/Documents/Project MOM/MsMinutes-AI-Meeting-Notes"

# Remove non-essential files
rm -rf .agents .conversation api-server.log frontend.log scripts
rm -f .replit .replitignore replit.md
rm -rf artifacts/mockup-sandbox

# Optional: Keep AGENTS.md as documentation
# rm AGENTS.md
```

### Step 2: Create .gitignore (if not exists)

```bash
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
.nyc_output/
.tsbuildinfo
EOF
```

### Step 3: Commit and Push to GitHub

```bash
git add .
git commit -m "Prepare for deployment v1.0"
git push origin main
```

### Step 4: Set Up Supabase Database

1. Create Supabase project
2. Get connection string from Settings > Database
3. Update DATABASE_URL in Render environment variables
4. Run migration using the provided script:
   ```bash
   DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]" ./scripts/deploy-db.sh
   ```
   Or manually:
   ```bash
   cd lib/db
   DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]" pnpm exec drizzle-kit push --config ./drizzle.config.ts
   ```

### Step 5: Deploy Backend to Render

1. Create Web Service on Render
2. Connect GitHub repo
3. Configure as shown above
4. Add environment variables
5. Deploy

### Step 6: Deploy Frontend to Vercel

1. Create project on Vercel
2. Connect GitHub repo
3. Configure as shown above
4. Add `VITE_API_URL`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_PUBLISHABLE_KEY` environment variables
5. Deploy

### Step 7: Update Frontend API URL

If your frontend API URL is different from backend, update `artifacts/ms-minutes/src/hooks/use-process-audio.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://your-backend.onrender.com';
```

## Alternative: Single Platform Deployment

### Option A: Render (Both Frontend + Backend)

You can deploy both on Render:
- Backend: Web Service
- Frontend: Static Site (build the frontend and deploy as static files)

### Option B: Railway (Full Stack)

Railway offers a free tier with PostgreSQL included:
- Go to [railway.app](https://railway.app)
- Create a new project
- Add PostgreSQL database
- Add backend service
- Add frontend service
- Configure environment variables

## Post-Deployment Checklist

- [ ] Database migration run successfully
- [ ] Backend health check returns 200: `curl https://your-backend.onrender.com/api/healthz`
- [ ] Frontend loads in browser
- [ ] Can upload audio file
- [ ] Dashboard displays meeting data
- [ ] Environment variables are set correctly
- [ ] CORS is configured (if needed)

## Monitoring

### Render
- View logs in Render dashboard
- Monitor resource usage

### Vercel
- View deployment logs in Vercel dashboard
- Monitor analytics

### Supabase
- View database usage in Supabase dashboard
- Monitor query performance

## Cost Summary (Free Tier)

| Service | Free Tier Limits | Cost |
|---------|------------------|------|
| Supabase | 500MB DB, 1GB bandwidth | $0 |
| Render | 512MB RAM, 0.1 CPU, sleeps after 15min | $0 |
| Vercel | 100GB bandwidth, unlimited sites | $0 |
| **Total** | | **$0/month** |

## Limitations to Note

1. **Render Sleep Mode:** Backend will sleep after 15min inactivity, first request takes ~30s to wake up
2. **Supabase:** 500MB database storage, 60-second connection limit
3. **Gemini API:** Free tier has rate limits, may need to upgrade for production use
4. **File Upload:** 50MB limit (as configured in code)

## Scaling When Needed

When you exceed free tier limits:
1. **Render:** Upgrade to Starter ($7/month) - removes sleep mode
2. **Supabase:** Upgrade to Pro ($25/month) - 8GB storage
3. **Vercel:** Upgrade to Pro ($20/month) - 1TB bandwidth
4. **Gemini:** Upgrade to paid API tier

## Troubleshooting

### Backend Fails to Start
- Check Render logs for errors
- Verify DATABASE_URL is correct
- Verify GEMINI_API_KEY is set

### Frontend Can't Connect to Backend
- Check CORS configuration in backend
- Verify VITE_API_URL is correct
- Check backend is running (not sleeping)

### Database Connection Failed
- Verify Supabase project is active
- Check DATABASE_URL format
- Run migration manually if needed

### Gemini API Errors
- Verify API key is valid
- Check for rate limits
- Consider upgrading to paid tier if frequent errors
