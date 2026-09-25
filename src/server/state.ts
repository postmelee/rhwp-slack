import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

/** Metadata only: never persist document bytes, bearer tokens or signed transfer URLs. */
export class State {
  private db:DatabaseSync;
  private closed=false;
  constructor(path:string,private team:string){
    if(path!==':memory:'){
      path=resolve(path);mkdirSync(dirname(path),{recursive:true,mode:0o700});
    }
    this.db=new DatabaseSync(path);
    if(path!==':memory:')chmodSync(path,0o600);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records(team TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(team,kind,key));`);
  }
  get<T>(kind:string,key:string):T|undefined {
    const row=this.db.prepare('SELECT value FROM records WHERE team=? AND kind=? AND key=?').get(this.team,kind,key);
    return row?JSON.parse(String(row.value)) as T:undefined;
  }
  all<T>(kind:string):[string,T][]{
    return this.db.prepare('SELECT key,value FROM records WHERE team=? AND kind=?').all(this.team,kind).map(row=>[String(row.key),JSON.parse(String(row.value)) as T]);
  }
  put(kind:string,key:string,value:unknown):void {
    this.db.prepare('INSERT INTO records(team,kind,key,value) VALUES(?,?,?,?) ON CONFLICT(team,kind,key) DO UPDATE SET value=excluded.value').run(this.team,kind,key,JSON.stringify(value));
  }
  delete(kind:string,key:string):void{this.db.prepare('DELETE FROM records WHERE team=? AND kind=? AND key=?').run(this.team,kind,key);}
  /** Synchronous transactions only; never perform network work inside the callback. */
  atomic<T>(work:()=>T):T {
    this.db.exec("BEGIN IMMEDIATE");
    try{const result=work();if(result instanceof Promise)throw new Error("Async SQLite transaction is not supported");this.db.exec("COMMIT");return result;}
    catch(error){this.db.exec("ROLLBACK");throw error;}
  }
  close():void{if(!this.closed){this.closed=true;this.db.close();}}
}
