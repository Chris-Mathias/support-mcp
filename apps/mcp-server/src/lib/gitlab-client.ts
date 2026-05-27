export function gitlabApiBase(repoUrl: string): string {
  const u = new URL(repoUrl);
  return `${u.protocol}//${u.host}/api/v4`;
}
