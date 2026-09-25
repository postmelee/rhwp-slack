import type {Card} from './documents';
export function documentMetadata(card:Card,origin:string,previewUrl?:string):Record<string,unknown> {
    return {url:`${origin}/documents/${card.id}`,external_ref:{id:card.id,type:'document'},entity_type:'slack#/entities/file',entity_payload:{
      attributes:{title:{text:card.name},display_type:'rhwp에서 편집 · 이 카드를 클릭하세요',product_name:'rhwp',full_size_preview:{is_supported:true,mime_type:'application/vnd.slack-embed',...(previewUrl?{preview_url:previewUrl}:{})}},
      slack_file:{id:card.fileId,type:/\.hwpx$/i.test(card.name)?'hwpx':'hwp'},fields:{},
      custom_fields:previewUrl?[]:[
        ...(card.pdfFileId?[{key:'pdf_file',label:'PDF 파일',type:'slack#/types/file',slack_file:{id:card.pdfFileId}}]:[]),
      ],display_order:[]}};
  }
function documentText(card:Card):string{return card.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
export function documentGallery(card:Card){
    // Slack appends file_ids; keep a contiguous prefix so a failed upload cannot reorder pages.
    const sorted=[...(card.images??[])].sort((a,b)=>a.page-b.page);
    const gap=sorted.findIndex((image,index)=>image.page!==index+1);
    return gap<0?sorted:sorted.slice(0,gap);
  }
// Browser beta has no Work Objects metadata to share private PDF/revision uploads.
export function documentFileIds(card:Card,editorMode:'embed'|'browser'='embed'):string[]{
    return [...new Set([...(editorMode==='browser'?[...(card.parentId?[card.fileId]:[]),...(card.pdfFileId?[card.pdfFileId]:[])]:[]),...documentGallery(card).map(image=>image.fileId)])];
  }
export function documentMessage(card:Card,origin:string,editorMode:'embed'|'browser'='embed'):Record<string,unknown>{
    const images=documentGallery(card),fileIds=documentFileIds(card,editorMode);
    const detail=card.pageCount?card.pageCount+'페이지':'페이지 확인 중';
    const pdf=card.pdf==='ready'&&card.pdfUrl?' · <'+card.pdfUrl+'|PDF로 보기>':card.pdf==='failed'?' · PDF 준비 실패':' · PDF 준비 중';
    const blocks:Record<string,unknown>[]=[{type:'section',text:{type:'mrkdwn',text:'*'+documentText(card)+'* · '+detail+pdf}}];
    if(card.recovery?.state==='running')blocks.push({type:'context',elements:[{type:'plain_text',text:card.recovery.attempt===0?'미리보기 요청을 접수했습니다. PDF·이미지를 준비할 차례를 기다리고 있습니다.':'PDF·이미지를 다시 준비하고 있습니다.'}]});
    if(card.recovery?.state==='retrying')blocks.push({type:'context',elements:[{type:'plain_text',text:`준비가 지연되어 자동으로 다시 시도합니다. (${card.recovery.attempt}/${card.recovery.maxAttempts}회 시도)`}]});
    if(card.pdf==='failed'&&card.recovery?.state==='failed')blocks.push({type:'actions',elements:[{type:'button',action_id:'rhwp_retry_preview',value:card.id,text:{type:'plain_text',text:'문서 미리보기 다시 준비'}}]});
    if(card.imageState==='pending')blocks.push({type:'context',elements:[{type:'plain_text',text:'페이지 이미지를 준비하고 있습니다.'}]});
    else if(card.pdf==='ready'&&card.pageCount&&(images.length<Math.min(10,card.pageCount)||card.imageState==='failed')){
      blocks.push({type:'actions',elements:[{type:'button',action_id:'rhwp_more_pages',value:card.id,text:{type:'plain_text',text:card.imageState==='failed'?'이미지 다시 준비':'추가 페이지 이미지 보기 (최대 10페이지)'}}]});
    }
    if(card.pageCount&&card.pageCount>10&&images.length===10)blocks.push({type:'context',elements:[{type:'plain_text',text:'앞 10페이지를 표시했습니다. 전체 문서는 PDF로 볼 수 있습니다.'}]});
    if(editorMode==='browser')blocks.push({type:'actions',elements:[{type:'button',action_id:'rhwp_browser_edit',text:{type:'plain_text',text:'rhwp에서 편집'},url:browserEditorUrl(card,origin)}]});
    return {channel:card.actor.channelId,...(fileIds.length?{file_ids:fileIds}:{}),text:documentText(card)+' · '+detail,blocks,parse:'none',unfurl_links:false,unfurl_media:false,...(editorMode==='embed'?{metadata:{entities:[documentMetadata(card,origin)]}}:{})};
  }

export function browserEditorUrl(card:Card,origin:string):string{return origin+'/browser/open?'+new URLSearchParams({workspace:card.actor.teamId,document:card.id}).toString();}
