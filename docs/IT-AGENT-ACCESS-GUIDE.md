# EPS Intelligence - Agent Access Control Guide

> **Audience:** IT Administrators  
> **Purpose:** Configure user access to AI agents in the EPS Intelligence application  
> **Last Updated:** December 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Setting Up Agent Access Groups](#setting-up-agent-access-groups)
5. [Granting Permissions on Serving Endpoints](#granting-permissions-on-serving-endpoints)
6. [Okta Integration (Optional)](#okta-integration-optional)
7. [User Provisioning Workflow](#user-provisioning-workflow)
8. [Revoking Access](#revoking-access)
9. [Troubleshooting](#troubleshooting)
10. [Quick Reference](#quick-reference)

---

## Overview

The EPS Intelligence application allows users to chat with AI agents deployed on Databricks. Each agent serves a different purpose (e.g., Account Intelligence, HR Assistant, Finance Reports).

**Key Concept:** Users should only see and access agents relevant to their role. This is controlled via **Databricks Serving Endpoint Permissions**.

### Permission Levels

| Permission | Description |
|------------|-------------|
| `CAN_QUERY` | User can send requests to the agent (required for chat) |
| `CAN_MANAGE` | User can modify the endpoint configuration (admin only) |

**Users need `CAN_QUERY` permission on each agent they should access.**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Access Control Flow                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────┐      ┌─────────────────┐      ┌────────────────────┐     │
│   │  Okta    │ ───▶ │   Databricks    │ ───▶ │  EPS Intelligence  │     │
│   │  (SSO)   │      │   Workspace     │      │  App               │     │
│   └──────────┘      └─────────────────┘      └────────────────────┘     │
│                              │                         │                │
│                              ▼                         ▼                │
│                     ┌─────────────────┐      ┌────────────────────┐     │
│                     │  User Groups    │      │  Agent Dropdown    │     │
│                     │  ├─ eps-users   │      │  (filtered by      │     │
│                     │  ├─ hr-users    │      │   permissions)     │     │
│                     │  └─ fin-users   │      └────────────────────┘     │
│                     └─────────────────┘                                 │
│                              │                                          │
│                              ▼                                          │
│                     ┌─────────────────┐                                 │
│                     │ Serving         │                                 │
│                     │ Endpoints       │                                 │
│                     │ (Agents)        │                                 │
│                     └─────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

Before configuring agent access, ensure:

- [ ] User has an active Databricks workspace account
- [ ] User can log in via Okta SSO to Databricks
- [ ] The AI agent serving endpoints are deployed and running
- [ ] You have admin access to Databricks workspace

---

## Setting Up Agent Access Groups

Using groups simplifies permission management. Create one group per agent.

### Step 1: Navigate to Groups

1. Log in to **Databricks Workspace**
2. Go to **Settings** (gear icon, bottom left)
3. Click **Identity and access**
4. Select **Groups**

### Step 2: Create Agent Access Groups

Click **Create group** and create the following groups:

| Group Name | Purpose |
|------------|---------|
| `eps-intelligence-eps-users` | Users who can access the EPS Account Agent |
| `eps-intelligence-hr-users` | Users who can access the HR Assistant Agent |
| `eps-intelligence-finance-users` | Users who can access the Finance Reports Agent |
| `eps-intelligence-admins` | Users who can access ALL agents |

> **Naming Convention:** `eps-intelligence-{agent}-users`

### Step 3: Add Members to Groups

1. Click on a group name
2. Click **Add members**
3. Search for users by email
4. Click **Add**

**Example:**
```
Group: eps-intelligence-eps-users
Members:
  - sarah.jones@company.com
  - mike.smith@company.com
  - jennifer.lee@company.com
```

---

## Granting Permissions on Serving Endpoints

Each agent group needs `CAN_QUERY` permission on its corresponding serving endpoint.

### Step 1: Navigate to Serving Endpoints

1. In Databricks, go to **Serving** (left sidebar)
2. You'll see a list of deployed endpoints

### Step 2: Configure Permissions

For each agent endpoint:

1. **Click on the endpoint name** (e.g., `agents_eps_account_agent`)
2. Click the **Permissions** button (top right)
3. Click **+ Add**
4. Search for the corresponding group
5. Select **CAN_QUERY** from the dropdown
6. Click **Add**

### Permission Matrix

Configure the following permissions:

| Serving Endpoint | Group | Permission |
|------------------|-------|------------|
| `agents_eps_account_agent` | `eps-intelligence-eps-users` | CAN_QUERY |
| `agents_eps_account_agent` | `eps-intelligence-admins` | CAN_QUERY |
| `agents_hr_assistant` | `eps-intelligence-hr-users` | CAN_QUERY |
| `agents_hr_assistant` | `eps-intelligence-admins` | CAN_QUERY |
| `agents_finance_reports` | `eps-intelligence-finance-users` | CAN_QUERY |
| `agents_finance_reports` | `eps-intelligence-admins` | CAN_QUERY |

> **Important:** The app's service principal also needs `CAN_QUERY` on all endpoints. This should already be configured during deployment.

### Using Databricks CLI (Alternative)

For bulk configuration, use the Databricks CLI:

```bash
# Grant EPS users access to EPS agent
databricks permissions update serving-endpoints agents_eps_account_agent \
  --json '{
    "access_control_list": [
      {
        "group_name": "eps-intelligence-eps-users",
        "permission_level": "CAN_QUERY"
      }
    ]
  }'
```

---

## Okta Integration (Optional)

If your Databricks workspace uses Okta with SCIM provisioning, you can manage access entirely from Okta.

### Step 1: Create Okta Groups

In Okta Admin Console, create groups that mirror the Databricks groups:

| Okta Group | Maps to Databricks Group |
|------------|--------------------------|
| `EPS-Intelligence-EPS-Users` | `eps-intelligence-eps-users` |
| `EPS-Intelligence-HR-Users` | `eps-intelligence-hr-users` |
| `EPS-Intelligence-Finance-Users` | `eps-intelligence-finance-users` |
| `EPS-Intelligence-Admins` | `eps-intelligence-admins` |

### Step 2: Configure SCIM Sync

Ensure these Okta groups are included in the SCIM push to Databricks:

1. In Okta Admin, go to **Applications → Databricks**
2. Click **Push Groups** tab
3. Add the EPS Intelligence groups to push

### Step 3: Verify Sync

After pushing, verify groups appear in Databricks:
- Databricks → Settings → Groups
- You should see the Okta groups with members synced

### Benefit

With SCIM configured, adding a user to an Okta group automatically:
1. Syncs them to the Databricks group
2. Grants them access to the corresponding agent
3. No manual Databricks configuration needed

---

## User Provisioning Workflow

### New User Request

When a user submits a ticket requesting EPS Intelligence access:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Provisioning Checklist                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  □ 1. Verify user has Databricks workspace access                   │
│       └─ If not, provision via standard Databricks onboarding       │
│                                                                     │
│  □ 2. Determine which agents user needs                             │
│       └─ Ask manager or refer to role matrix                        │
│                                                                     │
│  □ 3. Add user to appropriate group(s)                              │
│       └─ Option A: Add to Okta groups (if SCIM enabled)             │
│       └─ Option B: Add to Databricks groups directly                │
│                                                                     │
│  □ 4. (If using Okta) Assign user to EPS Intelligence bookmark app  │
│       └─ Okta Admin → Applications → EPS Intelligence → Assign      │
│                                                                     │
│  □ 5. Notify user                                                   │
│       └─ Provide app URL and brief instructions                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Role-Based Access Matrix

| Role | EPS Agent | HR Agent | Finance Agent |
|------|-----------|----------|---------------|
| EPS Manager | ✅ | ✅ | ❌ |
| EPS Analyst | ✅ | ❌ | ❌ |
| HR Business Partner | ❌ | ✅ | ❌ |
| Finance Analyst | ❌ | ❌ | ✅ |
| Executive | ✅ | ✅ | ✅ |
| IT Admin | ✅ | ✅ | ✅ |

> **Note:** Customize this matrix based on your organization's requirements.

---

## Revoking Access

### Remove User from Specific Agent

1. Go to **Databricks → Settings → Groups**
2. Click on the agent group (e.g., `eps-intelligence-eps-users`)
3. Find the user and click **Remove**

Or via Okta:
1. Go to **Okta Admin → Directory → Groups**
2. Select the group → **People** tab
3. Remove the user

### Remove All EPS Intelligence Access

Remove user from all `eps-intelligence-*` groups.

### What Happens After Revocation

- User's next page load will show updated agent list
- Existing chat history with revoked agents becomes inaccessible
- No data is deleted; access can be restored by re-adding to group

---

## Troubleshooting

### User Can't See Any Agents

**Symptoms:** User logs in but dropdown is empty or shows error.

**Check:**
1. Is user in any `eps-intelligence-*` group?
2. Does the group have `CAN_QUERY` on the serving endpoint?
3. Is the serving endpoint running? (Check Serving page)

### User Can't See a Specific Agent

**Symptoms:** User sees some agents but not others.

**Check:**
1. Is user in the correct group for that agent?
2. Does the group have `CAN_QUERY` on that specific endpoint?

### Permission Changes Not Reflecting

**Symptoms:** Added user to group but they still can't access agent.

**Try:**
1. Have user log out and log back in
2. Clear browser cache
3. Wait 5-10 minutes for permission cache to expire
4. If using Okta SCIM, verify sync completed

### Okta Groups Not Syncing

**Check:**
1. Is the group added to SCIM push groups?
2. Are there SCIM sync errors in Okta?
3. Is the Databricks SCIM integration active?

---

## Quick Reference

### Databricks URLs

| Resource | Path |
|----------|------|
| Serving Endpoints | `https://<workspace>.cloud.databricks.com/serving` |
| Groups | `https://<workspace>.cloud.databricks.com/settings/workspace/groups` |
| EPS Intelligence App | `https://eps-intelligence-prod.<workspace>.cloud.databricks.com` |

### CLI Commands

```bash
# List serving endpoints
databricks serving-endpoints list

# Get endpoint permissions
databricks permissions get serving-endpoints <endpoint-name>

# Add group permission
databricks permissions update serving-endpoints <endpoint-name> \
  --json '{"access_control_list": [{"group_name": "<group>", "permission_level": "CAN_QUERY"}]}'

# List groups
databricks groups list

# Add user to group
databricks groups patch <group-id> \
  --json '{"add": [{"value": "<user-id>"}]}'
```

### Support Contacts

| Issue Type | Contact |
|------------|---------|
| App bugs/features | Tony Kipkemboi (Business Systems & IT) |
| Databricks workspace access | IT Help Desk |
| Agent endpoint issues | Data Engineering Team |

---

## Appendix: Adding a New Agent

When a new AI agent is deployed:

1. **Create a new group:** `eps-intelligence-{agent-name}-users`
2. **Grant CAN_QUERY** on the new serving endpoint to:
   - The new user group
   - The `eps-intelligence-admins` group
   - The app service principal
3. **Update this guide** with the new agent in the permission matrix
4. **(If using Okta)** Create corresponding Okta group and configure SCIM push
5. **Notify app maintainer** to add agent to app configuration

---

*Questions? Contact Tony Kipkemboi or the Business Systems & IT team.*

