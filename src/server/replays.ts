import type {State} from './state';
import {UserError} from './errors';
export class Replays {
  private entries=new Map<string,number>();
  constructor(private now=Date.now,private state?:State) {for(const [key,value] of state?.all<number>('replays')??[])this.entries.set(key,value);this.sweep();}
  sweep():void {for(const [key,until] of this.entries)if(until<=this.now()){this.entries.delete(key);this.state?.delete('replays',key);}}
  release(key:string):void {this.entries.delete(key);this.state?.delete('replays',key);}
  claim(key:string):boolean {
    this.sweep();if(this.entries.has(key))return false;
    if(this.entries.size>=10_000)throw new UserError('replay_full','요청이 많습니다. 잠시 후 다시 시도하세요.');
    this.entries.set(key,this.now()+24*60*60_000);this.state?.put('replays',key,this.entries.get(key));return true;
  }
}
