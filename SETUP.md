# EPS Intelligence - Setup Guide

This guide walks you through setting up the EPS Intelligence app for local development and connecting to Lakebase for persistent chat history.

## Prerequisites

1. **Node.js 18+** and **npm 8+**
2. **Databricks CLI** (latest version)
   ```bash
   # macOS
   brew install databricks
   brew upgrade databricks && databricks -v
   ```

3. **Access to a Databricks workspace** with:
   - An Agent serving endpoint (e.g., `agents_eps_intelligence-agents-eps_account_agent`)
   - (Optional) A Lakebase database instance for chat history

---

## Step 1: Clone and Install Dependencies

```bash
git clone <repo-url>
cd eps-chatbot
npm install
```

---

## Step 2: Configure Databricks CLI Authentication

Set up authentication with your Databricks workspace:

```bash
# Set your profile name
export DATABRICKS_CONFIG_PROFILE='eps_chatbot'

# Login (this opens a browser for OAuth)
databricks auth login --profile "$DATABRICKS_CONFIG_PROFILE"

# Verify authentication
databricks auth describe --profile "$DATABRICKS_CONFIG_PROFILE"
```

---

## Step 3: Create Environment File

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Databricks Auth Configuration
DATABRICKS_CONFIG_PROFILE=eps_chatbot
DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
DATABRICKS_SERVING_ENDPOINT=your-agent-serving-endpoint-name
```

---

## Step 4: Connect Lakebase Database (Optional but Recommended)

If you want persistent chat history, you need to connect to a Lakebase database.

### 4a. Check if you have a Lakebase instance

```bash
# List all database instances in your workspace
databricks database list-database-instances --profile eps_chatbot
```

If you see an instance (e.g., `eps-intelligence-lakebase-dev-your-username`), note the `read_write_dns` value.

### 4b. If no instance exists, deploy one

First, uncomment the database sections in `databricks.yml`:

1. **DATABASE RESOURCE (1)** - around lines 17-21:
   ```yaml
   resources:
     database_instances:
       chatbot_lakebase:
         name: ${var.database_instance_name}-${var.resource_name_suffix}
         capacity: CU_1
   ```

2. **DATABASE RESOURCE (2)** - around lines 39-46:
   ```yaml
   - name: database
     description: "Lakebase database instance for the EPS Intelligence chat app"
     database:
       database_name: databricks_postgres
       instance_name: ${resources.database_instances.chatbot_lakebase.name}
       permission: CAN_CONNECT_AND_CREATE
   ```

Then deploy:

```bash
databricks bundle deploy --profile eps_chatbot
```

### 4c. Get your database host

```bash
# Using the helper script
bash scripts/get-pghost.sh

# Or manually (replace with your instance name)
databricks database get-database-instance "eps-intelligence-lakebase-dev-your-username" --profile eps_chatbot | jq -r .read_write_dns
```

### 4d. Add database config to `.env.local`

Add these lines to your `.env.local`:

```bash
# Lakebase Database Configuration
PGHOST=instance-xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.database.cloud.databricks.com
PGUSER=your.email@company.com
PGDATABASE=databricks_postgres
PGPORT=5432
```

**Note:** `PGUSER` should be your Databricks username (usually your email).

### 4e. Run database migrations

```bash
npm run db:migrate
```

You should see:
```
✅ Schema 'ai_chatbot' ensured to exist
✅ All migrations applied successfully
✅ Database migration completed successfully
```

---

## Step 5: Run the Application

```bash
npm run dev
```

This starts:
- **Client** on http://localhost:3000
- **Server** on http://localhost:3001

### Verify database connection

In the terminal logs, look for:
```
[isDatabaseAvailable] Database available: true
```

If you see `Database available: false`, check your `.env.local` database configuration.

---

## Troubleshooting

### "Database available: false"

1. Ensure all `PG*` variables are set in `.env.local`
2. Restart the dev server after changing `.env.local`
3. Verify your Lakebase instance is in `AVAILABLE` state:
   ```bash
   databricks database list-database-instances --profile eps_chatbot | jq '.[].state'
   ```

### "databricks auth: cannot configure default credentials"

Run the login command:
```bash
databricks auth login --profile eps_chatbot
```

### Migration errors

If migrations fail, check:
1. Your `PGUSER` matches your Databricks username exactly
2. The Lakebase instance is active
3. You have `CAN_CONNECT_AND_CREATE` permission on the database

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Drizzle Studio (visual DB editor) |
| `npm run db:reset` | Reset database (⚠️ DESTRUCTIVE) |
| `npm test` | Run all tests |

---

## Deployment to Databricks Apps

```bash
# Validate bundle configuration
databricks bundle validate --profile eps_chatbot

# Deploy
databricks bundle deploy --profile eps_chatbot

# Start the app
databricks bundle run databricks_chatbot --profile eps_chatbot
```

---

## Configuration Reference

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABRICKS_CONFIG_PROFILE` | CLI profile name | `eps_chatbot` |
| `DATABRICKS_HOST` | Workspace URL | `https://dbc-xxx.cloud.databricks.com` |
| `DATABRICKS_SERVING_ENDPOINT` | Agent endpoint name | `agents_eps_intelligence-agents-eps_account_agent` |

### Optional Database Variables (for chat history)

| Variable | Description | Example |
|----------|-------------|---------|
| `PGHOST` | Lakebase DNS | `instance-xxx.database.cloud.databricks.com` |
| `PGUSER` | Your Databricks username | `user@company.com` |
| `PGDATABASE` | Database name | `databricks_postgres` |
| `PGPORT` | Port (default 5432) | `5432` |

---

## App Customization

The app has been customized for Guild's EPS team:

- **App name**: "EPS Intelligence"
- **Browser title**: "EPS Intelligence"  
- **Sidebar**: Guild logo with "EPS Intelligence" subtitle
- **Colors**: Guild brand colors (Orange #ED732E, Gold #C29832, Redwood #BF6B45)
- **Suggested prompts**: EPS-specific account queries

To modify branding, see:
- `client/src/components/app-sidebar.tsx` - Sidebar header
- `client/src/components/greeting.tsx` - Welcome message
- `client/src/components/animation-assistant-icon.tsx` - Color gradients
- `client/index.html` - Browser title

