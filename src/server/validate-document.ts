import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {UserError} from './errors';
export function validateDocument(bytes:Buffer,timeoutMs=30_000):Promise<void>{
  return new Promise((done,reject)=>{
    const child=spawn(process.execPath,[resolve('src/conversion/validate-child.mjs')],{stdio:['pipe','pipe','pipe'],env:{PATH:process.env.PATH}});
    let output='';let settled=false;
    const finish=(ok:boolean)=>{if(settled)return;settled=true;clearTimeout(timer);child.kill('SIGKILL');if(ok)done();else reject(new UserError('invalid_document','문서를 확인하지 못했습니다. 지원되는 200페이지 이하 HWP/HWPX인지 확인하세요.'));};
    const timer=setTimeout(()=>finish(false),timeoutMs);
    child.on('error',()=>finish(false));child.stdin.on('error',()=>{});child.stderr.resume();
    child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>16)finish(false);});
    child.on('close',code=>finish(code===0&&output==='ok'));child.stdin.end(bytes);
  });
}
