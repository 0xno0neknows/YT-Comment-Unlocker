# PostgreSQL Setup Guide

This guide explains how to set up the YouTube Comments Extension backend with PostgreSQL, including local development and cloud database providers.

## Local Development Setup

### Prerequisites
1. **PostgreSQL** installed locally (or use Docker)
2. **Node.js** 18+ installed

### Option A: Local PostgreSQL

1. Create a database:
   ```sql
   CREATE DATABASE ytcomments;
   ```

2. Update `.env` file:
   ```
   DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/ytcomments?schema=public"
   ```

3. Push the schema:
   ```bash
   npm run db:push
   ```

4. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

5. Start the server:
   ```bash
   npm start
   ```

### Option B: Docker (No local PostgreSQL needed)

1. Start PostgreSQL with Docker:
   ```bash
   docker run --name ytcomments-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=ytcomments -p 5432:5432 -d postgres:16
   ```

2. Use default `.env`:
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/ytcomments?schema=public"
   ```

3. Push schema and start:
   ```bash
   npm run db:push
   npm run db:generate
   npm start
   ```

---

## Cloud Database Providers

### 1. Supabase (Recommended - Free Tier)

1. Go to [supabase.com](https://supabase.com) and create account
2. Create a new project
3. Go to **Settings → Database → Connection string**
4. Copy the **URI** (starts with `postgresql://`)
5. Replace `[YOUR-PASSWORD]` with your database password
6. Update `.env`:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
   ```

**Free Tier:** 500MB storage, unlimited API requests

### 2. Neon (Serverless - Free Tier)

1. Go to [neon.tech](https://neon.tech) and create account
2. Create a new project
3. Go to **Dashboard → Connection Details**
4. Copy the connection string
5. Update `.env`:
   ```
   DATABASE_URL="postgresql://username:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
   ```

**Free Tier:** 0.5 GB storage, auto-suspend after 5 min inactivity

### 3. Railway (Easy Deployment)

1. Go to [railway.app](https://railway.app)
2. Create new project → Add PostgreSQL
3. Go to **Variables** tab
4. Copy `DATABASE_URL`
5. You can also deploy the server here!

**Free Tier:** $5 credit/month

### 4. Render

1. Go to [render.com](https://render.com)
2. Create new PostgreSQL database
3. Copy **External Database URL**
4. Update `.env` with the URL

**Free Tier:** 90-day limit, then requires paid plan

---

## After Setting Up Cloud Database

1. Update your `.env` with the cloud DATABASE_URL

2. Push the schema to the cloud database:
   ```bash
   npm run db:push
   ```

3. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

4. Start the server:
   ```bash
   npm start
   ```

---

## Prisma Commands Reference

| Command | Description |
|---------|-------------|
| `npm run db:push` | Push schema to database (creates tables) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Create migration files |
| `npm run db:studio` | Open Prisma Studio (GUI for database) |

---

## Deploying the Server

To deploy your backend server, you can use:

1. **Railway** - Connect GitHub repo, auto-deploys
2. **Render** - Free web services
3. **Vercel** - Serverless (need to convert to serverless functions)
4. **Fly.io** - Docker-based deployment
5. **DigitalOcean** - VPS deployment

Remember to:
- Set `DATABASE_URL` as an environment variable
- Update the extension's `API_BASE` URL to your deployed server URL
