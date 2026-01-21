# EPS Account Intelligence Agent - High-Level Architecture

```mermaid
graph TB
    %% User Layer
    User[👤 User Browser<br/>Okta SSO Authentication]

    %% Presentation Layer
    subgraph Presentation["🎨 PRESENTATION LAYER"]
        UI[React UI - Databricks Apps<br/>https://eps-agent-dev-*.databricksapps.com<br/>• JWT Validation RS256<br/>• Chain of Thought Display<br/>• Source Carousel]
    end

    %% Authentication
    subgraph Authentication["🔐 AUTHENTICATION LAYER"]
        DBX[Databricks Platform<br/>OIDC Provider<br/>• Issues JWT Token<br/>• RS256 Signature]
        ActAs[ActAs Pattern RFC 8693<br/>• Email Normalization<br/>• X-Glean-ActAs Header]
    end

    %% Agent Layer
    subgraph AgentLayer["🤖 AGENT ORCHESTRATION LAYER"]
        Agent[MLflow ResponsesAgent<br/>LLM: Claude/GPT-5<br/>• System Prompt Loading<br/>• Tool Registry 7 Tools<br/>• Streaming Responses]

        Tools[🔧 Tool Execution<br/>━━━━━━━━━━━━━━━━━━━<br/>1️⃣ search_salesforce_opportunities<br/>2️⃣ search_salesforce_accounts<br/>3️⃣ search_salesforce_contacts<br/>4️⃣ search_metrics_and_dashboards<br/>5️⃣ search_strategy_docs<br/>6️⃣ search_communications<br/>7️⃣ search_general_fallback]
    end

    %% Integration Layer
    subgraph Integration["🔍 INTEGRATION LAYER"]
        Glean[Glean Enterprise Search<br/>guild-be.glean.com<br/>• User Permission Enforcement<br/>• Semantic Search<br/>• Datasource Filtering]
    end

    %% Data Sources
    subgraph DataSources["📊 DATA SOURCES"]
        SF[Salesforce<br/>CRM<br/>Opportunities<br/>Accounts<br/>Contacts]
        Drive[Google Drive<br/>Documents<br/>QBRs<br/>Account Plans<br/>Strategy]
        Gong[Gong<br/>Call Intel<br/>Recordings<br/>Transcripts<br/>Sentiment]
        Comms[Gmail + Slack<br/>Communications<br/>Emails<br/>Messages<br/>Threads]
        Looker[Looker<br/>Analytics<br/>Dashboards<br/>Metrics<br/>Funding Caps]
    end

    %% Deployment Infrastructure
    subgraph Deployment["🚀 DEPLOYMENT INFRASTRUCTURE"]
        Local[💻 Local Dev<br/>eps-chatbot/<br/>deploy.sh]
        Workspace[📁 Databricks Workspace<br/>eps-chatbot-source/<br/>Synced Code]
        UC[📚 Unity Catalog<br/>eps_intelligence_dev<br/>agents.eps_agent_dev<br/>MLflow Registration]
        Serving[⚡ Model Serving<br/>databricks-eps-agent-dev<br/>Serverless Auto-Scale<br/>Environment Variables]
    end

    %% Security
    subgraph Security["🛡️ SECURITY & SECRETS"]
        Secrets[🔑 Databricks Secrets<br/>eps_agent_scope<br/>━━━━━━━━━━━━━━━━<br/>GLEAN_INSTANCE<br/>GLEAN_GLOBAL_TOKEN<br/>LLM_ENDPOINT]
    end

    %% Main Flow
    User -->|1. SSO Login| DBX
    DBX -->|2. JWT Token| UI
    UI -->|3. POST /serving-endpoints<br/>+ user_email| Agent
    Agent -->|4. Initialize| Tools
    Tools -->|5. Search Query<br/>+ ActAs Header| Glean

    %% ActAs Flow
    Agent -.->|Retrieve Token| Secrets
    Tools -.->|Email Normalization| ActAs
    ActAs -.->|X-Glean-ActAs| Glean

    %% Data Source Connections
    Glean -->|User-Scoped<br/>Results| SF
    Glean -->|User-Scoped<br/>Results| Drive
    Glean -->|User-Scoped<br/>Results| Gong
    Glean -->|User-Scoped<br/>Results| Comms
    Glean -->|User-Scoped<br/>Results| Looker

    %% Response Flow
    Tools -->|6. Formatted Results| Agent
    Agent -->|7. Stream Response| UI
    UI -->|8. Display| User

    %% Deployment Flow
    Local -->|./deploy.sh dev<br/>Build + Sync| Workspace
    Workspace -->|databricks bundle deploy| UC
    UC -->|Deploy Model| Serving
    Serving -.->|Powers| Agent

    %% Styling
    classDef userStyle fill:#e1f5ff,stroke:#0066cc,stroke-width:3px
    classDef presentationStyle fill:#fff4e1,stroke:#ff9900,stroke-width:2px
    classDef authStyle fill:#ffe1e1,stroke:#cc0000,stroke-width:2px
    classDef agentStyle fill:#e1ffe1,stroke:#00cc00,stroke-width:3px
    classDef integrationStyle fill:#f0e1ff,stroke:#9900cc,stroke-width:2px
    classDef dataStyle fill:#e8f4f8,stroke:#0099cc,stroke-width:2px
    classDef deployStyle fill:#fffae1,stroke:#ccaa00,stroke-width:2px
    classDef securityStyle fill:#ffe8e8,stroke:#cc3300,stroke-width:2px

    class User userStyle
    class Presentation presentationStyle
    class UI presentationStyle
    class Authentication authStyle
    class DBX authStyle
    class ActAs authStyle
    class AgentLayer agentStyle
    class Agent agentStyle
    class Tools agentStyle
    class Integration integrationStyle
    class Glean integrationStyle
    class DataSources dataStyle
    class SF,Drive,Gong,Comms,Looker dataStyle
    class Deployment deployStyle
    class Local,Workspace,UC,Serving deployStyle
    class Security securityStyle
    class Secrets securityStyle
```

## Key Components

| Layer | Component | Purpose |
|-------|-----------|---------|
| **Presentation** | React UI (Databricks Apps) | User interface with JWT validation, Chain of Thought display |
| **Authentication** | Databricks OIDC + ActAs | OAuth 2.0 flow with user impersonation pattern |
| **Agent** | MLflow ResponsesAgent | LLM-powered agent with tool execution capability |
| **Tools** | 7 Search Tools | Specialized tools for different data sources and types |
| **Integration** | Glean Enterprise Search | Unified search API with permission enforcement |
| **Data Sources** | 5 Enterprise Systems | Salesforce, Drive, Gong, Gmail/Slack, Looker |
| **Deployment** | Databricks Infrastructure | Unity Catalog, Model Serving, Serverless Compute |
| **Security** | Secrets + Audit | Encrypted tokens, complete audit trail, user-scoped access |

## Data Flow Summary

```
User Query → JWT Validation → Agent (LLM) → Tool Selection →
Glean Search (ActAs) → Data Sources → Results → Agent Synthesis →
Stream Response → UI Display
```

## Security Properties

- ✅ **User Identity**: Verified by Databricks (cannot be spoofed)
- ✅ **Token Security**: Global token encrypted, never exposed to browser
- ✅ **Permission Enforcement**: Glean enforces actual user permissions
- ✅ **Audit Trail**: Complete logging with actual user identity

## Deployment Command

```bash
cd /Users/tonykipkemboi/Workspace/eps-chatbot
./deploy.sh dev
```

**Time to Deploy**: 3-5 minutes
