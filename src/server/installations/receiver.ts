import {App,ExpressReceiver,LogLevel,type Logger} from '@slack/bolt';
import {ID} from '../config';
import {object} from '../errors';
import {createCloudReceiver} from '../cloud/receiver';
import {InstallationError} from './store';
import type {Tenants,Tenant} from './tenants';
const logger:Logger={debug(){},info(){},warn(){},error(){},setLevel(){},getLevel(){return LogLevel.ERROR;},setName(){}};
export function distributedReceiver(options:{appId:string;signingSecret:string;tenants:Tenants;extend?:(runtime:ReturnType<typeof createCloudReceiver>,tenant:Tenant)=>void; lifecycle?:(team:string,event:Record<string,unknown>)=>Promise<void>}){
  const receiver=new ExpressReceiver({signingSecret:options.signingSecret,endpoints:'/slack/events',signatureVerification:true,processBeforeResponse:true,bodyLimit:'256kb',logger,
    processEventErrorHandler:async({response})=>{if(!response.headersSent)response.writeHead(503).end('Please retry');return true;}});
  class Dispatcher extends App {
    override async processEvent(event:Parameters<App['processEvent']>[0]):Promise<void>{
      // ExpressReceiver calls this only after its timestamp and raw-body signature verification.
      const b=object(event.body),embedded=b.team===undefined?undefined:object(b.team).id,team=b.team_id??embedded;
      if(b.api_app_id!==options.appId||b.is_enterprise_install===true||typeof team!=='string'||!ID.team.test(team)||(embedded!==undefined&&embedded!==team)){await event.ack();return;}
      if(b.type==='event_callback'&&['app_uninstalled','tokens_revoked'].includes(String(object(b.event).type))){
        if(options.lifecycle)await options.lifecycle(team,b);await event.ack();return;
      }
      let tenant:Tenant;try{tenant=await options.tenants.resolve(team);}catch(error){if(error instanceof InstallationError){await event.ack();return;}throw error;}
      const runtime=createCloudReceiver(tenant.config,tenant.documents,tenant.identity);options.extend?.(runtime,tenant);
      await runtime.app.processEvent(event);
    }
  }
  const app=new Dispatcher({receiver,logger,authorize:async()=>{throw new InstallationError();}});
  receiver.router.get('/healthz',(_req,res)=>res.json({ok:true}));
  return {receiver,app};
}
