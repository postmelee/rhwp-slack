import {readFileSync} from 'node:fs';
const args=process.argv.slice(2),manifest=JSON.parse(readFileSync(new URL('../slack/manifest.json',import.meta.url),'utf8'));
manifest.display_information.name='rhwp beta';
manifest.display_information.description='Slack에서 한글 문서를 미리 보고 브라우저에서 편집';
manifest.features.bot_user.display_name='rhwp-beta';
// User OpenID scopes are granted in a separate sign-in flow, never the bot installation URL.
manifest.oauth_config.scopes.user=['openid','profile'];
manifest.settings.event_subscriptions.bot_events=manifest.settings.event_subscriptions.bot_events.filter(e=>e!=='entity_details_requested');
manifest.settings.event_subscriptions.bot_events.push('app_uninstalled','tokens_revoked');
if(args.length===1&&args[0]==='--bootstrap'){
  // Create the app configuration without installing it or mixing bot/OpenID grants.
  delete manifest.oauth_config;
  delete manifest.features.slash_commands;delete manifest.features.shortcuts;
  delete manifest.settings.event_subscriptions;delete manifest.settings.interactivity;
}else if(args.length===2&&args[0]==='--origin'){
  const url=new URL(args[1]);if(url.protocol!=='https:'||url.origin!==args[1])throw new Error('HTTPS origin만 입력하세요.');
  const endpoint=url.origin+'/slack/events';manifest.features.slash_commands[0].url=endpoint;
  manifest.settings.event_subscriptions.request_url=endpoint;manifest.settings.interactivity.request_url=endpoint;
  manifest.oauth_config.redirect_urls=[url.origin+'/oauth/callback',url.origin+'/browser/callback'];
}else throw new Error('사용법: node scripts/slack-beta-manifest.mjs --bootstrap 또는 --origin https://HOST');
process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
