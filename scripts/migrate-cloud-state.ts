import {parseArgs} from 'node:util';
import {Firestore} from '@google-cloud/firestore';
import {FirestoreMetadata} from '../src/server/cloud/firestore-metadata';
import {migrateLegacy,readLegacySnapshot} from '../src/server/cloud/migrate';
const {values}=parseArgs({options:{source:{type:'string'},project:{type:'string'},environment:{type:'string'},team:{type:'string'},apply:{type:'boolean',default:false}},strict:true});
if(!values.source||!values.project||!values.environment||!values.team)throw new Error('Required: --source SQLITE --project PROJECT --environment ENV --team TEAM [--apply]');
// Uses Application Default Credentials; no Slack token or document bytes are needed.
const db=new Firestore({projectId:values.project});
try{
 const store=new FirestoreMetadata(db,values.environment,values.team);
 const rows=readLegacySnapshot(values.source,values.team);
 console.log(JSON.stringify(await migrateLegacy(store,rows,values.team,values.apply)));
}finally{await db.terminate();}
