import {ID,type Config} from './config';
import {authorizeChannel,type Actor} from './access';
import type {SlackApi} from './slack-api';
import type {State} from './state';
import {UserError,denied} from './errors';
export type ChannelMode='auto'|'mention'|'off';
interface Policy {mode:ChannelMode;updatedBy?:string;updatedAt:number;}
const labels:Record<ChannelMode,string>={auto:'자동 변환',mention:'멘션할 때만 변환',off:'이 채널에서 사용 안 함'};
const option=(value:ChannelMode)=>({text:{type:'plain_text',text:labels[value]},value});
export class Settings {
  readonly enabled=new Set<string>();
  private policies=new Map<string,Policy>();
  constructor(private config:Config,private api:SlackApi,private state?:State,private remote?:import('./cloud/metadata').MetadataStore){
    if(state?.get('settings','initialized')){
      for(const [id,policy] of state.all<Policy>('channels'))this.policies.set(id,policy);
    }else{
      for(const id of config.channelIds){const value:Policy={mode:'auto',updatedAt:Date.now()};this.policies.set(id,value);state?.put('channels',id,value);}
      state?.put('settings','initialized',true);
    }
    for(const [id,p] of this.policies)if(p.mode!=='off')this.enabled.add(id);
  }
  async refresh():Promise<void>{
    if(!this.remote)return;
    if(!await this.remote.get('settings','initialized')){
      for(const id of this.config.channelIds)await this.remote.atomic<Policy,void>('channels',id,current=>({value:current??{mode:'auto',updatedAt:Date.now()},result:undefined}));
      await this.remote.atomic('settings','initialized',()=>({value:true,result:undefined}));
    }
    this.policies=new Map(await this.remote.list<Policy>('channels'));this.enabled.clear();
    for(const [id,p] of this.policies)if(p.mode!=='off')this.enabled.add(id);
  }
  mode(channel:string):ChannelMode{return this.policies.get(channel)?.mode??'off';}
  isAdmin(team:string,user:string):boolean{return team===this.config.teamId&&ID.user.test(user)&&this.config.adminIds?.has(user)===true;}
  private admin(team:string,user:string):void{if(!this.isAdmin(team,user))throw new UserError('settings_admin','채널 설정은 rhwp 앱 관리자가 변경할 수 있습니다.');}
  async set(actor:Actor,mode:string):Promise<void>{
    this.admin(actor.teamId,actor.userId);await this.refresh();if(!['auto','mention','off'].includes(mode))denied();
    await authorizeChannel(this.api,this.config,actor,AbortSignal.timeout(2000),false);
    const value:Policy={mode:mode as ChannelMode,updatedBy:actor.userId,updatedAt:Date.now()};
    if(this.remote)await this.remote.atomic('channels',actor.channelId,()=>({value,result:undefined}));
    this.state?.put('channels',actor.channelId,value);this.policies.set(actor.channelId,value);
    if(mode==='off')this.enabled.delete(actor.channelId);else this.enabled.add(actor.channelId);
  }
  async open(team:string,user:string,triggerId:string,channel?:string):Promise<void>{
    this.admin(team,user);await this.refresh();
    const current=channel&&ID.channel.test(channel)?channel:undefined;
    await this.api.call('views.open',{trigger_id:triggerId,view:{type:'modal',callback_id:'rhwp_channel_settings',title:{type:'plain_text',text:'rhwp 채널 설정'},submit:{type:'plain_text',text:'저장'},close:{type:'plain_text',text:'취소'},blocks:[
      {type:'section',text:{type:'mrkdwn',text:'자동 변환은 새로 올린 한글 파일을 처리합니다. 필요한 문서만 처리하려면 멘션할 때만 변환을 선택하세요. 설정은 채널의 모든 사용자에게 적용됩니다.'}},
      {type:'input',block_id:'channel',label:{type:'plain_text',text:'채널'},element:{type:'conversations_select',action_id:'value',placeholder:{type:'plain_text',text:'채널 선택'},filter:{include:['public','private'],exclude_external_shared_channels:true},...(current?{initial_conversation:current}:{})}},
      {type:'input',block_id:'mode',label:{type:'plain_text',text:'동작 방식'},element:{type:'static_select',action_id:'value',options:(['auto','mention','off'] as const).map(option),initial_option:option(current&&this.mode(current)!=='off'?this.mode(current):'mention')}},
      {type:'context',elements:[{type:'plain_text',text:'멘션 모드에서도 /rhwp 명령과 메시지 메뉴로 직접 요청할 수 있습니다. 자동 감지는 활성화된 채널의 한글 파일만 처리합니다.'}]},
    ]}});
  }
  async home(team:string,user:string):Promise<void>{
    if(team!==this.config.teamId||!ID.user.test(user))denied();
    await this.refresh();const admin=this.isAdmin(team,user);
    const blocks:Record<string,unknown>[]=[
      {type:'header',text:{type:'plain_text',text:'한글 프로그램 없이 문서를 확인하고 편집하세요'}},
      {type:'section',text:{type:'mrkdwn',text:'*1. 사용할 채널에 rhwp를 초대하세요.*\n처음 초대한 채널은 자동 변환이 켜집니다. 이전에 설정한 채널은 기존 설정을 유지합니다.\n\n*2. HWP·HWPX 파일을 올리세요.*\n같은 스레드에 PDF와 첫 3페이지 이미지를 자동으로 만듭니다.\n\n*3. 수정이 필요하면 rhwp에서 편집을 누르세요.*\n브라우저에서 무료로 편집하고, 편집본을 같은 스레드에 저장할 수 있습니다.'}},
      {type:'section',text:{type:'mrkdwn',text:'*필요한 문서만 변환하고 싶나요?*\n채널 설정에서 *멘션할 때만 변환*을 선택하고, 파일이 있는 메시지의 스레드에서 @rhwp를 멘션하세요.\n기존 파일은 메시지 메뉴의 *한글 문서 열기*로 요청할 수 있습니다.'}},
      {type:'context',elements:[{type:'plain_text',text:'⏳ 변환 중 · ✅ PDF와 이미지 준비 완료 · ⚠️ 일부 또는 전체 변환 실패'}]},
    ];
    if(admin){
      blocks.push({type:'divider'},{type:'actions',elements:[{type:'button',action_id:'rhwp_settings',text:{type:'plain_text',text:'채널 설정'},style:'primary'}]});
      const visible:string[]=[];
      for(const [id,p] of this.policies){
        if(visible.length>=30)break;
        try{await authorizeChannel(this.api,this.config,{teamId:team,userId:user,channelId:id},undefined,false);visible.push(`<#${id}> · ${labels[p.mode]}`);}catch{/* Private channel membership is checked before listing its name or ID. */}
      }
      if(visible.length)blocks.push({type:'section',text:{type:'mrkdwn',text:'*채널 설정 현황*\n'+visible.join('\n')}});
    }else blocks.push({type:'context',elements:[{type:'plain_text',text:'채널 활성화와 동작 방식 변경은 rhwp 앱 관리자에게 요청해 주세요.'}]});
    await this.api.call('views.publish',{user_id:user,view:{type:'home',blocks}});
  }
}
