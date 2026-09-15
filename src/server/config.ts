export interface Config {
  signingSecret: string; botToken: string; appId: string; teamId: string;
  publicOrigin?: string; workspaceHost: string; channelIds: ReadonlySet<string>; port: number;
}
export const ID = {team:/^T[A-Z0-9]{2,}$/, app:/^A[A-Z0-9]{2,}$/, user:/^[UW][A-Z0-9]{2,}$/, channel:/^[CG][A-Z0-9]{2,}$/, file:/^F[A-Z0-9]{2,}$/};
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const required = (key: string, pattern: RegExp): string => {
    const value = env[key]?.trim();
    if (!value || !pattern.test(value)) throw new Error(`${key} 설정을 확인하세요.`);
    return value;
  };
  const channels = required('SLACK_CHANNEL_IDS', /^[A-Z0-9,\s]+$/).split(',').map(s=>s.trim());
  if (!channels.length || channels.some(id=>!ID.channel.test(id))) throw new Error('SLACK_CHANNEL_IDS 설정을 확인하세요.');
  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port<1 || port>65535) throw new Error('PORT 설정을 확인하세요.');
  const origin=new URL(required('APP_ORIGIN', /^https:\/\//));
  if(origin.username || origin.password || origin.pathname!=='/' || origin.search || origin.hash || /(^|\.)slack\.com$/.test(origin.hostname)) throw new Error('APP_ORIGIN 설정을 확인하세요.');
  return {
    publicOrigin:origin.origin,
    signingSecret:required('SLACK_SIGNING_SECRET', /^[a-f0-9]{32}$/i),
    botToken:required('SLACK_BOT_TOKEN', /^xoxb-[A-Za-z0-9-]+$/),
    appId:required('SLACK_APP_ID', ID.app), teamId:required('SLACK_TEAM_ID', ID.team),
    workspaceHost:required('SLACK_WORKSPACE_HOST', /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.slack\.com$/),
    channelIds:new Set(channels), port,
  };
}
