export class Startup {
  readonly controller=new AbortController();readonly signal=this.controller.signal;
  private timer:ReturnType<typeof setTimeout>;
  constructor(timeoutMs=120_000){this.timer=setTimeout(()=>this.cancel(new Error('문서를 여는 데 시간이 오래 걸립니다. 이 창을 닫고 Slack의 편집 카드를 다시 클릭해 주세요.')),timeoutMs);}
  cancel(error:unknown):void{clearTimeout(this.timer);this.controller.abort(error);}
  finish():void{this.signal.throwIfAborted();clearTimeout(this.timer);}
  async run<T>(create:()=>Promise<T>,disposeLate?:(value:T)=>void):Promise<T>{
    this.signal.throwIfAborted();
    let abort!:()=>void;
    const stopped=new Promise<never>((_,reject)=>{abort=()=>reject(this.signal.reason);this.signal.addEventListener('abort',abort,{once:true});});
    const operation=Promise.resolve().then(()=>{this.signal.throwIfAborted();return create();}).then(value=>{
      if(this.signal.aborted){disposeLate?.(value);throw this.signal.reason;}return value;
    });
    try{return await Promise.race([operation,stopped]);}finally{this.signal.removeEventListener('abort',abort);}
  }
}
