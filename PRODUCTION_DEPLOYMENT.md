# EPS Agent UI - Deployment Guide

## Overview

This guide covers deploying the EPS Account Intelligence Agent UI to Databricks Apps across different environments (dev, staging, prod).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EPS Agent Architecture                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────────┐     ┌─────────────┐ │
│  │   UI App     │────▶│  Model Serving   │────▶│   Glean     │ │
│  │ (Databricks  │     │    Endpoint      │     │   Search    │ │
│  │    Apps)     │     │  (EPS Agent)     │     │    API      │ │
│  └──────────────┘     └──────────────────┘     └─────────────┘ │
│         │                      │                               │
│         │                      │                               │
│         ▼                      ▼                               │
│  ┌──────────────┐     ┌──────────────────┐                    │
│  │  Lakebase    │     │   MLflow         │                    │
│  │  (Postgres)  │     │   Tracing        │                    │
│  └──────────────┘     └──────────────────┘                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Environment Configuration

### Target Environments

| Environment | Endpoint | Database | App Name |
|-------------|----------|----------|----------|
| **dev** | `eps_account_agent_dev` | `eps-intelligence-lakebase-dev-{username}` | `eps-agent-dev-{username}` |
| **staging** | `eps_account_agent_staging` | `eps-intelligence-lakebase-staging` | `eps-agent-staging` |
| **prod** | `eps_account_agent_prod` | `eps-intelligence-lakebase-prod` | `eps-agent-prod` |

### Authentication Patterns

| Environment | Auth Type | Secret Scope | Token |
|-------------|-----------|--------------|-------|
| **dev** | Personal Token | `eps_agent_dev` | `GLEAN_API_TOKEN` |
| **staging** | ActAs (Global) | `eps_agent_staging` | `GLEAN_GLOBAL_TOKEN` |
| **prod** | ActAs (Global) | `eps_agent` | `GLEAN_GLOBAL_TOKEN` |

> **Note**: ActAs pattern uses a global token with `X-Glean-ActAs` header to impersonate users. This requires a Glean Super Admin to create the global token.

---

## Prerequisites

### 1. Databricks CLI Setup

```bash
# Install Databricks CLI
pip install databricks-cli

# Configure profile
databricks configure --profile <your-profile-name>
```

### 2. Databricks Secrets

Create required secrets for your target environment:

```bash
# For dev (personal token)
databricks secrets create-scope eps_agent_dev
databricks secrets put-secret eps_agent_dev GLEAN_INSTANCE
databricks secrets put-secret eps_agent_dev GLEAN_API_TOKEN

# For staging/prod (ActAs global token)
databricks secrets create-scope eps_agent_staging  # or eps_agent for prod
databricks secrets put-secret eps_agent_staging GLEAN_INSTANCE
databricks secrets put-secret eps_agent_staging GLEAN_GLOBAL_TOKEN
```

### 3. Model Serving Endpoint

Ensure the agent serving endpoint is deployed and running:

```bash
databricks serving-endpoints get <endpoint-name>
```

---

## Deployment Steps

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd eps-intelligence-ui

# Install dependencies
npm install

# Verify no vulnerabilities
npm audit
```

### 2. Configure Environment

Update `databricks.yml` with your settings:

```yaml
variables:
  serving_endpoint_name:
    default: "eps_account_agent_<env>"
  database_instance_name:
    default: "eps-intelligence-lakebase-<env>"
```

### 3. Build and Deploy

```bash
# Build the application
npm run build

# Deploy to target environment
./deploy.sh <target>  # dev, staging, or prod
```

### 4. Verify Deployment

1. Check app status in Databricks Apps UI
2. Open the app URL (shown after deployment)
3. Test authentication and basic queries
4. Verify MLflow traces are being logged

---

## MLflow Tracing & Monitoring

### Trace Configuration

The agent logs traces to MLflow with the following span types:

| Span Type | Purpose |
|-----------|---------|
| `AGENT` | Top-level agent execution |
| `LLM` | LLM API calls |
| `TOOL` | Tool/search executions |
| `RETRIEVER` | Document retrieval (for scorers) |

### Scorers for Production Monitoring

Enable these scorers in the MLflow Experiment UI:

| Scorer | Purpose | Requirements |
|--------|---------|--------------|
| **RetrievalGroundedness** | Checks if response is grounded in retrieved context | RETRIEVER spans (included) |
| **eps_groundedness** (custom) | Fallback groundedness check | None (custom implementation) |
| **eps_tool_usage** (custom) | Verifies tools were called | None (custom implementation) |

> **Note**: Scorers like `Correctness` and `RetrievalSufficiency` require ground truth (`expected_response`) from evaluation datasets and cannot be used on live production traces.

### Token Redaction

Sensitive tokens are automatically redacted from traces using MLflow span processors:

```python
# Configured in agent code
mlflow.tracing.configure(span_processors=[_redact_glean_token])
```

This ensures `GLEAN_GLOBAL_TOKEN` never appears in MLflow trace logs.

---

## Security Considerations

### npm Security

This project uses npm overrides to resolve dependency vulnerabilities:

```json
{
  "overrides": {
    "lodash": "^4.17.21",
    "lodash-es": "^4.17.21",
    "esbuild": "^0.25.0"
  }
}
```

Run `npm audit` to verify 0 vulnerabilities before deployment.

### Secrets Management

- Never commit secrets to git
- Use Databricks secret scopes for all credentials
- Use `.env.local` for local development (gitignored)
- Tokens are injected at runtime via environment variables

### ActAs Authentication

When using ActAs pattern (staging/prod):
- User email is extracted from Databricks authentication
- Passed to Glean via `X-Glean-ActAs` header
- Each user sees only data they have permission to access in Glean

---

## Troubleshooting

### Deployment Issues

| Issue | Solution |
|-------|----------|
| "Profile not found" | Run `databricks auth profiles` and verify profile exists |
| "Permission denied" | Check workspace permissions in Databricks |
| "Build failed" | Run `npm run build` locally to see errors |
| "App won't start" | Check app logs in Databricks Apps dashboard |

### Runtime Issues

| Issue | Solution |
|-------|----------|
| "Authentication failed" | Verify secrets are set in correct scope |
| "No search results" | Check user has Glean access; verify SFDC B2B is open in browser |
| "Token visible in traces" | Verify span processor is registered |
| "Scorer errors" | Check RETRIEVER spans are being logged |

### Known Limitations

1. **SFDC B2B Dependency**: Some users report needing Salesforce B2B open in browser for Glean search to work (investigating session/cookie dependency)

2. **RetrievalSufficiency Scorer**: Requires `expected_response` field which is not available for production traces

---

## Rollback Plan

If issues occur after deployment:

```bash
# 1. Stop the app
databricks apps stop <app-name> --profile <profile>

# 2. Deploy previous version
git checkout <previous-commit>
./deploy.sh <target>

# 3. Verify rollback
# Check app URL and test functionality
```

---

## Maintenance

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update and verify
npm update
npm audit
npm run build
npm test  # if tests exist
```

### Deploying Agent Updates

When the backend agent (`eps_agent_prod.py`) is updated:

1. Update agent code in Databricks workspace
2. Re-deploy via MLflow/databricks-agents
3. Model serving endpoint automatically picks up new version
4. No UI redeployment needed (unless UI changes required)

### Syncing Environments

To promote changes from staging to prod:

```bash
# 1. Test thoroughly in staging
./deploy.sh staging

# 2. Once verified, deploy to prod
./deploy.sh prod
```

---

## Support

- **Databricks Apps**: [Documentation](https://docs.databricks.com/en/dev-tools/databricks-apps/index.html)
- **MLflow Tracing**: [Documentation](https://mlflow.org/docs/latest/genai/tracing/)
- **Databricks Agents**: [Documentation](https://docs.databricks.com/en/generative-ai/agent-framework/index.html)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-01-29 | Added security overrides, MLflow scorer docs | - |
| 2025-01-29 | Initial production deployment guide | - |
