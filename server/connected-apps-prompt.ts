// Every bot needs to know how Connected apps work, even when its own access is
// switched off. A bot without the grant must point the user at the exact
// toggle instead of claiming the service itself is not connected.
export interface ConnectedAppsPromptContext {
  /** The driver mounted the composio MCP tools for this turn. */
  mounted: boolean;
  /** The harness has a managed or self-hosted Composio connection. */
  configured: boolean;
  /** The selected engine can mount connected-app tools. */
  engineSupports: boolean;
  /** The user has not switched connected apps off for this bot. */
  botEnabled: boolean;
}

export function connectedAppsSystemPrompt(context: ConnectedAppsPromptContext): string {
  if (context.mounted) {
    return "The user's connected apps (Gmail, Calendar, Slack, Notion, Alpaca, and the rest) are reachable through the composio tools — find the right one with COMPOSIO_SEARCH_TOOLS, read its arguments with COMPOSIO_GET_TOOL_SCHEMAS, then run it with COMPOSIO_MULTI_EXECUTE_TOOL. Reach for them before telling the user you have no access to a service. If the user asks for an app that is not connected yet, tell them to open Connected apps from the puzzle icon in the sidebar and connect it there.";
  }
  if (!context.configured) {
    return "Connected apps are not configured on this harness yet. If the user asks for Gmail, Calendar, Slack, Alpaca, or another external app, tell them to open Connected apps from the puzzle icon in the sidebar (or App Settings → Connections), connect the app, then retry. Do not say the app is unavailable in KodBot.";
  }
  if (!context.engineSupports) {
    return "This bot's current engine cannot mount connected apps. If the user asks for Gmail, Calendar, Slack, Alpaca, or another external app, tell them the app may be connected but this engine cannot use it, and to switch this bot to an engine that supports connected apps in Bot settings → Model, then retry. Do not say the app is not connected.";
  }
  if (!context.botEnabled) {
    return "The user has connected apps on this harness, but connected-app access is switched off for this bot. When the user asks for Gmail, Calendar, Slack, Alpaca, or another external app, do not say the app is not connected. Tell them access is disabled for this bot and show both fixes: (1) open Bot settings (the gear icon next to this bot) → Connected apps → turn on \"Allow this bot to use connected apps\"; or (2) open Connected apps from the puzzle icon in the sidebar and use \"Allow for all bots\". Then ask them to retry.";
  }
  return "Connected apps are not available to this bot right now. If the user asks for an external app, tell them to check Bot settings (the gear icon next to this bot) → Connected apps and the Connected apps panel (the puzzle icon in the sidebar), then retry.";
}
