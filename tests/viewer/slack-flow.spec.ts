import {test,expect} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createSlackReceiver} from '../../src/server/receiver';
import {EditorApi} from '../slack/editor-support';
import {config,actor,bytes} from '../slack/support';
import {object} from '../../src/server/errors';
test('production HTTP ticket → real Studio edit → isolated validation → Slack upload adapter → real revision PDF',async({page})=>{
  const api=new EditorApi(),uploaded=new Map<string,Buffer>();
  const runtime=createSlackReceiver({...config,publicOrigin:'http://127.0.0.1:4176'},api,{botId:'BBOT',botUserId:'UBOT'},
    {download:async()=>bytes,fetcher:async(url,options)=>{uploaded.set(new URL(String(url)).pathname.split('/').pop()!,Buffer.from(options!.body as Uint8Array));return new Response('ok');}});
  await runtime.receiver.start({host:'127.0.0.1',port:4176});
  try{
    const {id}=runtime.preparations.submit({...actor,threadTs:'123.456'},'FTEST','open','browser');await runtime.preparations.idle();
    await runtime.documents!.present(id,actor,'browser.trigger');
    const metadata=object(api.calls.find(c=>c.method==='entity.presentDetails')!.args.metadata);
    const preview=object(object(object(metadata.entity_payload).attributes).full_size_preview);
    await page.goto(String(preview.preview_url));await expect(page.locator('#slack-save button')).toBeVisible({timeout:60_000});
    const input=page.frameLocator('#editor iframe').getByLabel('문서 편집 입력',{exact:true});await input.focus();await input.pressSequentially('Saved revision ');
    await expect(page).toHaveTitle(/^\* /);await page.locator('#slack-save button').click();await expect(page).toHaveTitle('문서.hwp · rhwp',{timeout:60_000});
    await expect(page.locator('#slack-save p')).toHaveText('편집본과 PDF를 Slack에 저장했습니다.',{timeout:60_000});
    await runtime.documents!.pdf.idle();
    const completions=api.calls.filter(c=>c.method==='files.completeUploadExternal');expect(completions).toHaveLength(3);
    for(const call of completions)expect(call.args).toMatchObject({channel_id:'CTEST',thread_ts:'123.456'});
    const edited=[...api.files.values()].find(f=>String(f.name).endsWith('_편집본.hwp'))!;
    const revisionPdf=[...api.files.values()].find(f=>String(f.name).endsWith('_편집본.pdf'))!;
    expect(edited).toBeTruthy();expect(revisionPdf).toBeTruthy();
    writeFileSync('test-results/slack-edited.hwp',uploaded.get(String(edited.id))!);
    const pdf=uploaded.get(String(revisionPdf.id))!;expect(pdf.subarray(0,5).toString()).toBe('%PDF-');writeFileSync('test-results/slack-edited.pdf',pdf);
    expect(runtime.documents!.source(id)).toEqual(bytes);expect(readFileSync('tests/fixtures/viewer-two-pages.hwp')).toEqual(bytes);
    await page.setViewportSize({width:669,height:863});await page.screenshot({path:'test-results/slack-production-flow.png'});
  }finally{await runtime.receiver.stop();await runtime.close();}
});
