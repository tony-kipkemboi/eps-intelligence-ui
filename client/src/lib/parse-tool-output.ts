/**
 * Represents a parsed source from tool output with full metadata
 */
export interface ParsedSource {
  title: string;
  url: string;
  datasource: string;
  content?: string;
  author?: string;
  updatedAt?: string;
}

/**
 * Parses markdown-formatted tool output to extract source information with full metadata.
 *
 * Expected format:
 * Found 5 result(s) from Google Drive
 *
 * **[1] Title Here**
 * - **Datasource: gdrive**
 * - Content: Some snippet text here...
 * - URL: https://...
 *
 * Or with author/date:
 * **[1] Title Here**
 * - **Datasource: slack**
 * - Author: John Doe
 * - Date: 2024-01-15
 * - Content: ...
 * - URL: https://...
 */
export function parseToolOutputSources(output: string): ParsedSource[] {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const sources: ParsedSource[] = [];

  // Split by result blocks (starting with **[N])
  const blocks = output.split(/(?=\*\*\[\d+\])/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    // Extract title: **[N] Title**
    const titleMatch = block.match(/\*\*\[\d+\]\s*([^*]+)\*\*/);
    if (!titleMatch) continue;

    const title = titleMatch[1].trim();

    // Extract URL
    const urlMatch = block.match(/-\s*URL:\s*(https?:\/\/[^\s\n]+)/i);
    if (!urlMatch) continue;

    const url = urlMatch[1].trim();

    // Extract datasource
    const datasourceMatch = block.match(
      /-\s*\*\*Datasource:\s*([^*]+)\*\*/i,
    );
    const datasource = datasourceMatch
      ? datasourceMatch[1].trim()
      : inferDatasource(url);

    // Extract content/snippet
    const contentMatch = block.match(/-\s*Content:\s*([^\n]+(?:\n(?!-).*)*)/i);
    const content = contentMatch
      ? contentMatch[1].trim().slice(0, 500) // Limit to 500 chars
      : undefined;

    // Extract author (if present)
    const authorMatch = block.match(/-\s*(?:Author|By):\s*([^\n]+)/i);
    const author = authorMatch ? authorMatch[1].trim() : undefined;

    // Extract date/timestamp (if present)
    const dateMatch = block.match(
      /-\s*(?:Date|Updated|Timestamp|Time):\s*([^\n]+)/i,
    );
    const updatedAt = dateMatch ? dateMatch[1].trim() : undefined;

    sources.push({
      title,
      url,
      datasource,
      content,
      author,
      updatedAt,
    });
  }

  // Fallback: if the standard pattern didn't match, try simpler extraction
  if (sources.length === 0) {
    const simplePattern =
      /\*\*([^*]+)\*\*[\s\S]*?(?:URL|url|Link|link):\s*(https?:\/\/[^\s\n]+)/gi;

    let match: RegExpExecArray | null = simplePattern.exec(output);
    while (match !== null) {
      const [, rawTitle, url] = match;
      if (rawTitle && url) {
        sources.push({
          title: rawTitle.replace(/^\[\d+\]\s*/, '').trim(),
          url: url.trim(),
          datasource: inferDatasource(url),
        });
      }
      match = simplePattern.exec(output);
    }
  }

  return sources;
}

/**
 * Infers the datasource type from a URL
 */
export function inferDatasource(url: string): string {
  const urlLower = url.toLowerCase();

  if (
    urlLower.includes('docs.google.com') ||
    urlLower.includes('drive.google.com')
  ) {
    return 'gdrive';
  }
  if (
    urlLower.includes('salesforce.com') ||
    urlLower.includes('lightning.force.com')
  ) {
    return 'salesforce';
  }
  if (urlLower.includes('slack.com')) {
    return 'slack';
  }
  if (urlLower.includes('mail.google.com') || urlLower.includes('gmail.com')) {
    return 'gmail';
  }
  if (urlLower.includes('gong.io')) {
    return 'gong';
  }
  if (urlLower.includes('aistudio.google.com')) {
    return 'gdrive';
  }
  if (urlLower.includes('looker')) {
    return 'looker';
  }

  return 'unknown';
}

/**
 * Extracts the summary line from tool output (e.g., "Found 5 result(s) from Google Drive")
 */
export function parseToolOutputSummary(output: string): string | null {
  if (!output || typeof output !== 'string') {
    return null;
  }

  // Match "Found X result(s) from Y"
  const summaryMatch = output.match(
    /^Found\s+(\d+)\s+result\(s\)\s+from\s+(.+)$/im,
  );
  if (summaryMatch) {
    return summaryMatch[0];
  }

  return null;
}

/**
 * Gets the tool display name from internal tool name
 */
export function getToolDisplayName(toolName: string | undefined): string {
  if (!toolName) return 'Tool Call';

  const displayNames: Record<string, string> = {
    search_strategy_docs: 'Searching documents',
    search_salesforce_accounts: 'Searching Salesforce accounts',
    search_salesforce_opportunities: 'Searching Salesforce opportunities',
    search_salesforce_contacts: 'Searching Salesforce contacts',
    search_metrics_and_dashboards: 'Searching metrics and dashboards',
    search_slack: 'Searching Slack',
    search_gmail: 'Searching Gmail',
    search_gong: 'Searching Gong calls',
    search_communications: 'Searching communications',
    search_general_fallback: 'Searching all sources',
    get_current_date: 'Getting current date',
  };

  return displayNames[toolName] || toolName.replace(/_/g, ' ');
}

/**
 * Build a source registry map from an array of tool outputs
 * Key is the URL, value is the full source metadata
 */
export function buildSourceRegistry(
  toolOutputs: string[],
): Map<string, ParsedSource> {
  const registry = new Map<string, ParsedSource>();

  for (const output of toolOutputs) {
    const sources = parseToolOutputSources(output);
    for (const source of sources) {
      // Use URL as key, don't overwrite if already exists
      if (!registry.has(source.url)) {
        registry.set(source.url, source);
      }
    }
  }

  return registry;
}
