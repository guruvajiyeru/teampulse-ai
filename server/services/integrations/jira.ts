export function formatJiraLogItem(issueKey: string, summary?: string): string {
  return `Closed JIRA ticket [${issueKey}] - ${summary || "Refactored module dependencies"}`;
}
