import type {SlackApi} from './slack-api';
import type {Actor} from './access';
import type {Config} from './config';
import {ID} from './config';
import {UserError,object} from './errors';
import {parseFileLink} from './commands';
export interface UploadAttempt {fileId?:string;url?:string;streamed?:boolean;completing?:boolean;saved?:boolean;permalink?:string;}
export class Uploads {
  constructor(private api:SlackApi,private config:Config,private fetcher:typeof fetch=fetch){}
  async share(attempt:UploadAttempt,bytes:Buffer,name:string,actor:Actor,beforeShare:()=>Promise<void>):Promise<{id:string;url?:string}> {
    if(!attempt.fileId){
      const r=await this.api.call('files.getUploadURLExternal',{filename:name,length:bytes.length});
      if(typeof r.file_id!=='string'||!ID.file.test(r.file_id)||typeof r.upload_url!=='string')throw new UserError('upload_failed','업로드를 준비하지 못했습니다.');
      const url=new URL(r.upload_url);
      if(url.protocol!=='https:'||url.hostname!=='files.slack.com'||url.port||url.username||url.password||!url.pathname.startsWith('/upload/v1/')||url.hash)throw new UserError('upload_url','업로드 주소를 확인할 수 없습니다.');
      attempt.fileId=r.file_id;attempt.url=url.href;
    }
    if(!attempt.streamed){
      try{
        const response=await this.fetcher(attempt.url!,{method:'POST',redirect:'error',headers:{'Content-Type':'application/octet-stream'},body:new Uint8Array(bytes),signal:AbortSignal.timeout(30_000)});
        await response.body?.cancel();if(!response.ok)throw new Error('stream');attempt.streamed=true;
      }catch{attempt.fileId=undefined;attempt.url=undefined;throw new UserError('upload_failed','파일 전송에 실패했습니다. 다시 저장해 주세요.');}
    }
    if(!attempt.saved && !attempt.completing){
      await beforeShare();attempt.completing=true;
      try{
        const result=await this.api.call('files.completeUploadExternal',{files:[{id:attempt.fileId,title:name}],channel_id:actor.channelId,...(actor.threadTs?{thread_ts:actor.threadTs}:{})});
        if(!Array.isArray(result.files)||!result.files.some(f=>object(f).id===attempt.fileId))throw new Error('missing receipt');
        attempt.saved=true;
      }catch{/* Completion might have succeeded. Reconcile this file ID; never complete a second file. */}
    }
    if(!attempt.saved){
      try {
      const f=object((await this.api.call('files.info',{file:attempt.fileId})).file);
      const shares=object(f.shares);const publicShares=shares.public as Record<string,unknown>|undefined;const privateShares=shares.private as Record<string,unknown>|undefined;
      const records=publicShares?.[actor.channelId]??privateShares?.[actor.channelId];
      if(f.id===attempt.fileId&&Array.isArray(records)&&records.some(r=>{const s=object(r);return s.team_id===actor.teamId&&(!actor.threadTs||s.thread_ts===actor.threadTs);}))attempt.saved=true;
      }catch{/* Reconciliation is inconclusive; retain the original attempt. */}
      if(!attempt.saved)throw new UserError('upload_uncertain','저장 결과를 확인 중입니다. 같은 저장 요청으로 다시 확인해 주세요.');
    }
    if(!attempt.permalink){
      try{const f=object((await this.api.call('files.info',{file:attempt.fileId})).file);if(f.id===attempt.fileId&&typeof f.permalink==='string'&&parseFileLink(f.permalink,this.config.workspaceHost)===attempt.fileId)attempt.permalink=f.permalink;}catch{/* Uploaded file remains saved even when the link lookup fails. */}
    }
    return {id:attempt.fileId!,url:attempt.permalink};
  }
}
