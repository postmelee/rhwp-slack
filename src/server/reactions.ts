import type {Actor} from './access';
import type {SlackApi} from './slack-api';
import type {State} from './state';
import {UserError} from './errors';
interface Work {actor:Actor;state:'pending'|'ready'|'failed';validated:boolean;updatedAt:number;}
const names=['hourglass_flowing_sand','white_check_mark','warning'];
/** One reaction state per original message, aggregated across all its requested files. */
export class Reactions {
  private works=new Map<string,Work>();
  private tails=new Map<string,Promise<void>>();
  constructor(private api:SlackApi,private enabled:boolean,private store?:State){for(const [id,w] of store?.all<Work>('reactions')??[])this.works.set(id,w);}
  register(id:string,actor:Actor):void{
    if(!actor.reactionTs||!/^\d+\.\d+$/.test(actor.reactionTs)||this.works.has(id))return;
    this.works.set(id,{actor:{...actor},state:'pending',validated:false,updatedAt:Date.now()});this.persist(id);
  }
  private persist(id:string):void{this.store?.put('reactions',id,this.works.get(id));}
  async start(id:string):Promise<void>{const w=this.works.get(id);if(!w)return;w.validated=true;this.persist(id);await this.sync(w.actor);}
  async finish(id:string,success:boolean):Promise<void>{const w=this.works.get(id);if(!w)return;w.state=success?'ready':'failed';w.updatedAt=Date.now();this.persist(id);await this.sync(w.actor);}
  private key(a:Actor):string{return JSON.stringify([a.teamId,a.channelId,a.reactionTs]);}
  private sync(actor:Actor):Promise<void>{
    if(!this.enabled)return Promise.resolve();
    const key=this.key(actor);
    const next=(this.tails.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
      const works=[...this.works.values()].filter(w=>this.key(w.actor)===key);
      if(!works.some(w=>w.validated))return;
      const target=works.some(w=>w.state==='pending')?names[0]:works.some(w=>w.state==='failed')?names[2]:names[1];
      for(const name of names){
        try{await this.api.call(name===target?'reactions.add':'reactions.remove',{channel:actor.channelId,timestamp:actor.reactionTs,name});}
        catch(e){if(!(e instanceof UserError)||!['already_reacted','no_reaction'].includes(e.code))throw e;}
      }
    }).catch(()=>{/* Cosmetic failures never repeat a conversion. Retry during recovery or the next transition. */});
    this.tails.set(key,next);void next.finally(()=>{if(this.tails.get(key)===next)this.tails.delete(key);});return next;
  }
  async recover(active:Set<string>):Promise<void>{
    for(const [id,w] of this.works){
      if(w.state==='pending'&&!active.has(id)){w.state='failed';this.persist(id);}
      if(w.validated)await this.sync(w.actor);
    }
  }
  sweep():void{for(const [id,w] of this.works)if(w.state!=='pending'&&Date.now()-w.updatedAt>7*24*60*60_000){this.works.delete(id);this.store?.delete('reactions',id);}}
  async idle():Promise<void>{await Promise.allSettled([...this.tails.values()]);}
}
