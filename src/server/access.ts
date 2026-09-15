import type {Config} from './config';
import {ID} from './config';
import type {SlackApi} from './slack-api';
import {denied, object} from './errors';
import {MAX_FILE_BYTES} from '../shared/errors';
export interface Actor {teamId:string; userId:string; channelId:string; threadTs?:string;}
export interface SourceFile {id:string; name:string; size:number; downloadUrl:string;}
export function assertActor(config: Config, actor: Actor): void {
  if (actor.teamId!==config.teamId || !ID.user.test(actor.userId) || !config.channelIds.has(actor.channelId)) denied();
}
export async function authorizeFile(api: SlackApi, config: Config, actor: Actor, fileId: string, signal?: AbortSignal): Promise<SourceFile> {
  assertActor(config,actor); if (!ID.file.test(fileId)) denied();
  const c=object((await api.call('conversations.info',{channel:actor.channelId},signal)).channel);
  if (c.id!==actor.channelId || (c.is_channel!==true && c.is_group!==true) ||
      typeof c.is_private!=='boolean' || c.is_im!==false || c.is_mpim!==false || c.is_member!==true || c.is_archived!==false ||
      c.is_ext_shared!==false || c.is_pending_ext_shared!==false || c.is_org_shared!==false || c.context_team_id!==actor.teamId) denied();
  if (!Array.isArray(c.pending_shared) || c.pending_shared.length || !Array.isArray(c.shared_team_ids) || c.shared_team_ids.length!==1 || c.shared_team_ids[0]!==actor.teamId) denied();
  let cursor=''; let found=false; const seen=new Set<string>();
  for (let page=0; page<100; page++) {
    const result=await api.call('conversations.members',{channel:actor.channelId,limit:200,...(cursor?{cursor}:{})},signal);
    if (!Array.isArray(result.members) || !result.members.every(id=>typeof id==='string')) denied();
    found ||= result.members.includes(actor.userId);
    const next=object(result.response_metadata).next_cursor;
    if (typeof next!=='string') denied();
    if (!next) break;
    if (seen.has(next) || page===99) denied();
    seen.add(next); cursor=next;
  }
  if (!found) denied();
  const f=object((await api.call('files.info',{file:fileId},signal)).file);
  if (f.id!==fileId || f.mode!=='hosted' || f.is_external!==false || f.is_restricted_sharing_enabled!==false ||
      (f.file_access!==undefined && f.file_access!=='visible') || f.is_tombstoned===true || f.has_more_shares===true ||
      (f.user_team!==undefined && f.user_team!==actor.teamId)) denied();
  for (const key of ['external_workspaces_with_read_access','dm_mpdm_users_with_file_access']) {
    if (f[key]!==undefined && (!Array.isArray(f[key]) || f[key].length!==0)) denied();
  }
  const shares=object(object(f.shares)[c.is_private?'private':'public'])[actor.channelId];
  if (!Array.isArray(shares) || !shares.some(value=>{
    const share=object(value);
    return share.team_id===actor.teamId && typeof share.ts==='string' && /^\d+\.\d+$/.test(share.ts);
  })) denied();
  if (typeof f.name!=='string' || !/\.(hwp|hwpx)$/i.test(f.name) || f.name.length>255 || /[\u0000-\u001f\u007f]/.test(f.name) ||
      typeof f.size!=='number' || !Number.isSafeInteger(f.size) || f.size<=0 || f.size>MAX_FILE_BYTES) denied();
  const downloadUrl=f.url_private_download ?? f.url_private;
  if (typeof downloadUrl!=='string') denied();
  return {id:fileId,name:f.name.normalize('NFC'),size:f.size,downloadUrl};
}
