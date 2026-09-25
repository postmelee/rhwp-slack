import {readFileSync} from 'node:fs';
const manifest=JSON.parse(readFileSync('slack/manifest.json','utf8'));
if(process.argv.length===3&&process.argv[2]==='--bootstrap'){
  delete manifest.features.slash_commands;delete manifest.features.shortcuts;
  delete manifest.settings.event_subscriptions;delete manifest.settings.interactivity;
}else if(process.argv.length===4&&process.argv[2]==='--origin'){
  const origin=new URL(process.argv[3]);
  if(origin.protocol!=='https:'||origin.pathname!=='/'||origin.search||origin.hash||origin.username||origin.password)throw new Error('HTTPS origin만 입력하세요.');
  const endpoint=origin.origin+'/slack/events';
  manifest.features.slash_commands[0].url=endpoint;
  manifest.settings.event_subscriptions.request_url=endpoint;
  manifest.settings.interactivity.request_url=endpoint;
}else throw new Error('사용법: node scripts/slack-manifest.mjs --bootstrap 또는 --origin https://HOST');
process.stdout.write(JSON.stringify(manifest,null,2)+'\n');
