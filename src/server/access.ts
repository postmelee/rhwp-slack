import {markSourceUnavailable} from './source-failure';
import type {Config} from './config';
import {ID} from './config';
import type {SlackApi} from './slack-api';
import {denied, objectWithReason as object} from './errors';
import {MAX_FILE_BYTES} from '../shared/errors';
export interface Actor {teamId:string; userId:string; channelId:string; threadTs?:string; reactionTs?:string;}
export interface SourceFile {id:string; name:string; size:number; downloadUrl:string;}
export function assertActor(config: Config, actor: Actor): void {
  if (actor.teamId!==config.teamId || !ID.user.test(actor.userId) || !config.channelIds.has(actor.channelId)) denied('actor_policy');
}
export async function authorizeChannel(api:SlackApi,config:Config,actor:Actor,signal?:AbortSignal,enabled=true):Promise<Record<string,unknown>>{
  if(actor.teamId!==config.teamId||!ID.user.test(actor.userId)||!ID.channel.test(actor.channelId))denied('actor_policy');
  if(enabled)assertActor(config,actor);
  const c=await authorizeBotChannel(api,config,actor,signal);
  let cursor=''; let found=false; const seen=new Set<string>();
  for (let page=0; page<100; page++) {
    const result=await api.call('conversations.members',{channel:actor.channelId,limit:200,...(cursor?{cursor}:{})},signal);
    if (!Array.isArray(result.members) || !result.members.every(id=>typeof id==='string')) denied('actor_membership');
    found ||= result.members.includes(actor.userId);
    const next=object(result.response_metadata,'actor_membership').next_cursor;
    if (typeof next!=='string') denied('actor_membership');
    if (!next) break;
    if (seen.has(next) || page===99) denied('actor_membership');
    seen.add(next); cursor=next;
  }
  if (!found) denied('actor_membership');
  return c;
}
/** Status-only updates still require the bot's same-workspace channel access. */
export async function authorizeBotChannel(api:SlackApi,config:Config,actor:Actor,signal?:AbortSignal):Promise<Record<string,unknown>>{
  if(actor.teamId!==config.teamId||!ID.channel.test(actor.channelId))denied('channel_policy');
  const c=object((await api.call('conversations.info',{channel:actor.channelId},signal)).channel,'channel_policy');
  if (c.id!==actor.channelId || (c.is_channel!==true && c.is_group!==true) ||
      typeof c.is_private!=='boolean' || c.is_im!==false || c.is_mpim!==false || c.is_member!==true || c.is_archived!==false ||
      c.is_ext_shared!==false || c.is_pending_ext_shared!==false || c.is_org_shared!==false || c.context_team_id!==actor.teamId) denied('channel_policy');
  if (!Array.isArray(c.pending_shared) || c.pending_shared.length || !Array.isArray(c.shared_team_ids) || c.shared_team_ids.length!==1 || c.shared_team_ids[0]!==actor.teamId) denied('channel_policy');
  return c;
}
export async function authorizeFile(api: SlackApi, config: Config, actor: Actor, fileId: string, signal?: AbortSignal): Promise<SourceFile> {
  assertActor(config,actor);if(!ID.file.test(fileId))denied('invalid_source_metadata');
  const c=await authorizeChannel(api,config,actor,signal);
  let response:Record<string,unknown>;
  try{response=await api.call('files.info',{file:fileId},signal);}catch(error){markSourceUnavailable(error);throw error;}
  const f=object(response.file,'file_visibility');
  if (f.id!==fileId || f.mode!=='hosted' || f.is_external!==false || (f.is_restricted_sharing_enabled!==undefined && f.is_restricted_sharing_enabled!==false) ||
      (f.file_access!==undefined && f.file_access!=='visible') || f.is_tombstoned===true || f.has_more_shares===true || f.skipped_shares===true ||
      (f.restriction_type!==undefined && f.restriction_type!==0) ||
      (f.user_team!==undefined && f.user_team!==actor.teamId)) denied('file_visibility');
  for (const key of ['external_workspaces_with_read_access','dm_mpdm_users_with_file_access']) {
    if (f[key]!==undefined && (!Array.isArray(f[key]) || f[key].length!==0)) denied('file_visibility');
  }
  // Slack's ordinary hosted-file response can omit the restricted-sharing flag.
  // Require the complete visible channel-sharing shape; omission alone grants nothing.
  if(f.is_restricted_sharing_enabled===undefined){
    const listed=f[c.is_private?'groups':'channels'];
    if(f.file_access!=='visible' || f.user_team!==actor.teamId || f.has_more_shares!==false ||
        !Array.isArray(f.channels) || !f.channels.every(id=>typeof id==='string'&&ID.channel.test(id)) ||
        !Array.isArray(f.groups) || !f.groups.every(id=>typeof id==='string'&&ID.channel.test(id)) ||
        !Array.isArray(f.ims) || f.ims.length!==0 || !Array.isArray(listed) || !listed.includes(actor.channelId)) denied('share_shape');
  }
  const shares=object(object(f.shares,'share_shape')[c.is_private?'private':'public'],'share_shape')[actor.channelId];
  if (!Array.isArray(shares) || !shares.some(value=>{
    const share=object(value,'share_shape');
    return share.team_id===actor.teamId && typeof share.ts==='string' && /^\d+\.\d+$/.test(share.ts);
  })) denied('share_shape');
  if (typeof f.name!=='string' || !/\.(hwp|hwpx)$/i.test(f.name) || f.name.length>255 || /[\u0000-\u001f\u007f]/.test(f.name) ||
      typeof f.size!=='number' || !Number.isSafeInteger(f.size) || f.size<=0 || f.size>MAX_FILE_BYTES) denied('invalid_source_metadata');
  const downloadUrl=f.url_private_download ?? f.url_private;
  if (typeof downloadUrl!=='string') denied('invalid_source_metadata');
  return {id:fileId,name:f.name.normalize('NFC'),size:f.size,downloadUrl};
}
