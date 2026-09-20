import { defineConfig } from 'vite';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import {staticVersion} from '../scripts/static-version.mjs';
// Vite resolves symlinks before transform; compare against the same canonical path.
const root = realpathSync('.cache/studio-source/rhwp-studio');
const requiredOverlays = new Set(['src/main.ts','src/ui/chrome-mode.ts','src/ui/options-dialog.ts'].map(p => resolve(root,p)));
const appliedOverlays = new Set<string>();
const replaceOnce = (code: string, from: string, to: string): string => {
  if (code.split(from).length !== 2) throw new Error(`Studio overlay anchor changed: ${from}`);
  return code.replace(from, to);
};
export default defineConfig({
  root, base: '/static/'+staticVersion()+'/studio/', publicDir: resolve('.cache/studio-public'),
  define: { __APP_VERSION__: JSON.stringify('0.8.6'), __RHWP_DISABLE_EXTERNAL_WEBFONTS__: true, __RHWP_HWPCTRL__: true },
  resolve: { alias: {
    '@': resolve(root,'src'),
    '@wasm': resolve('node_modules/@rhwp/core'),
    '@rhwp/hwpctrl/studio-plugin': resolve('.cache/studio-source/npm/hwpctrl-ocx/src/studio-plugin.mjs'),
  } },
  plugins: [{
    name: 'slack-studio-policy', enforce: 'pre',
    buildStart() { appliedOverlays.clear(); },
    buildEnd(error) {
      if (!error) for (const path of requiredOverlays) if (!appliedOverlays.has(path)) this.error('Required Slack Studio overlay was not applied: '+path);
    },
    transform(code, id) {
      const path = id.split('?')[0];
      if (['/recovery/autosave-store.ts','/recent/recent-store.ts','/history/idb-store.ts'].some(s => path.endsWith(s))) {
        return readFileSync(resolve('studio/adapters/persistence.ts'),'utf8');
      }
      if (path === resolve(root,'src/main.ts')) {
        code = replaceOnce(code, 'resolveChromeModeRequest(window.location.search)', "resolveChromeModeRequest('?chrome=embed')");
        code = replaceOnce(code, 'isRecoveryBlocked: () => wasm.requiresPasswordForSave', 'isRecoveryBlocked: () => true');
        code = replaceOnce(code, 'recoveryEnabled: settings.recoveryEnabled', 'recoveryEnabled: false');
        code = replaceOnce(code, 'idleEnabled: settings.idleSaveEnabled', 'idleEnabled: false');
        code = replaceOnce(code, 'autosaveManager.connect(eventBus);', `autosaveManager.connect(eventBus);
          eventBus.on('document-dirty-changed', (change) => {
            if (window.parent !== window) window.parent.postMessage({ type: 'rhwp-slack:dirty', dirty: (change as {dirty:boolean}).dirty }, window.location.origin);
          });`);
        code = replaceOnce(code, 'notifySaved: (fileName?: string) => completeHostSave(fileName),', `notifySaved: (fileName?: string) => completeHostSave(fileName),
          notifySavedIfUnchanged: async (expected: {documentEpoch:number;changeSeq:number;documentSha256:string}) => {
            const current = documentAgent?.getDocumentState();
            if (!current || current.documentEpoch !== expected.documentEpoch || current.changeSeq !== expected.changeSeq || current.documentSha256 !== expected.documentSha256) return false;
            // No await between the revision check and markClean in completeHostSave.
            await completeHostSave();
            return true;
          },`);
        code = replaceOnce(code, 'await loadFromUrlParam();', '// Slack host owns document loading; ignore URL document sources.');
      }
      if (path === resolve(root,'src/ui/chrome-mode.ts')) {
        code = replaceOnce(code, "'edit:compare-documents',", "'edit:compare-documents', 'edit:document-history',");
      }
      if (path === resolve(root,'src/ui/options-dialog.ts')) {
        code = replaceOnce(code, '대형 문서는 자동저장 시 전체 HWP 복구본을 만들기 때문에 간격을 길게 두면 편집 중 멈춤을 줄일 수 있습니다.', 'Slack에서는 복구본과 자동 저장을 사용하지 않습니다. 창을 닫으면 저장하지 않은 편집 내용이 사라집니다.');
        for (const [field,setting] of [['recoveryEnabledCheck','recoveryEnabled'],['idleSaveEnabledCheck','idleSaveEnabled']]) {
          code = replaceOnce(code, `this.${field}.checked = autosave.${setting};`, `this.${field}.checked = false; this.${field}.disabled = true; this.${field}.title = 'Slack에서는 문서 자동 저장을 사용하지 않습니다.';`);
        }
      }
      if (requiredOverlays.has(path)) appliedOverlays.add(path);
      return code;
    },
  }],
  build: { outDir: resolve('dist/studio'), emptyOutDir:true, target:'es2022' },
});
