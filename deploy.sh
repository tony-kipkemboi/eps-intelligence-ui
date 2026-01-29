#!/bin/bash
set -e  # Exit on any error

PROFILE="eps_chatbot"
TARGET="${1:-prod}"  # Default to prod for this production deployment
PROJECT_DIR="/Users/tonykipkemboi/Workspace/eps-intel-ui-prod/eps-intelligence-ui"
WORKSPACE_SOURCE="/Workspace/Users/tony.kipkemboi@guild.com/eps-agent-prod-source"

echo "🚀 Deploying EPS Agent UI to Databricks Apps"
echo "Target: $TARGET"
echo "Profile: $PROFILE"
echo ""

cd "$PROJECT_DIR"

# Step 1: Build the application
echo "🔨 Building application..."
npm run build

if [ ! -d "client/dist" ] || [ ! -d "server/dist" ]; then
  echo "❌ Error: Build failed - dist folders not found"
  exit 1
fi

echo "✅ Build complete"
echo ""

# Step 2: Clean up problematic files in workspace
echo "🧹 Cleaning workspace..."

# Remove .databricks folder (contains large terraform binaries that cause deployment failures)
databricks workspace delete "$WORKSPACE_SOURCE/.databricks" --recursive --profile "$PROFILE" 2>/dev/null || true

# Remove .git folder (not needed for deployment)
databricks workspace delete "$WORKSPACE_SOURCE/.git" --recursive --profile "$PROFILE" 2>/dev/null || true

echo "✅ Workspace cleaned"
echo ""

# Step 3: Sync critical source files to workspace
echo "📤 Syncing source files to workspace..."

# Sync the 3 critical UI files
databricks workspace import "$WORKSPACE_SOURCE/client/src/components/message.tsx" \
  --file client/src/components/message.tsx \
  --format AUTO \
  --overwrite \
  --profile "$PROFILE"

databricks workspace import "$WORKSPACE_SOURCE/client/src/components/elements/chain-of-thought.tsx" \
  --file client/src/components/elements/chain-of-thought.tsx \
  --format AUTO \
  --overwrite \
  --profile "$PROFILE"

databricks workspace import "$WORKSPACE_SOURCE/client/src/lib/parse-tool-output.ts" \
  --file client/src/lib/parse-tool-output.ts \
  --format AUTO \
  --overwrite \
  --profile "$PROFILE"

echo "✅ Source files synced"
echo ""

# Step 4: Sync built dist folders
echo "📦 Syncing built artifacts..."

databricks workspace import-dir \
  client/dist \
  "$WORKSPACE_SOURCE/client/dist" \
  --overwrite \
  --profile "$PROFILE"

databricks workspace import-dir \
  server/dist \
  "$WORKSPACE_SOURCE/server/dist" \
  --overwrite \
  --profile "$PROFILE"

echo "✅ Built artifacts synced"
echo ""

# Step 5: Deploy bundle
echo "🚢 Deploying bundle..."
databricks bundle deploy --target "$TARGET" --profile "$PROFILE"

echo "✅ Bundle deployed"
echo ""

# Step 6: Start the app
echo "🏃 Starting app (creating new deployment snapshot)..."
databricks bundle run databricks_chatbot --target "$TARGET" --profile "$PROFILE" &

DEPLOY_PID=$!

echo ""
echo "✅ Deployment initiated (PID: $DEPLOY_PID)"
echo ""
echo "📊 This will take 3-5 minutes. Monitor progress:"
echo "   • Check Databricks workspace UI"
echo "   • Navigate to /Workspace/Users/881f3cd3-1bdb-40d3-86b3-f270e95d420f/src/"
echo "   • Look for new deployment folder with current timestamp"
echo ""
echo "🌐 App URL:"
if [ "$TARGET" = "prod" ]; then
  echo "   https://eps-agent-prod-7711090402957940.aws.databricksapps.com"
elif [ "$TARGET" = "dev" ]; then
  echo "   https://eps-agent-dev-tony-kipkemboi-7711090402957940.aws.databricksapps.com"
elif [ "$TARGET" = "staging" ]; then
  echo "   https://eps-agent-staging-7711090402957940.aws.databricksapps.com"
fi
echo ""
echo "💡 After deployment completes:"
echo "   1. Open the app URL"
echo "   2. Hard refresh your browser (Cmd+Shift+R / Ctrl+Shift+R)"
echo "   3. Test: Ask a question with multiple tool calls"
echo "   4. Verify: Single 'Show work • X sources' section appears"
echo ""
