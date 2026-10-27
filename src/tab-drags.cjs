const {validate}=require('./window-state.cjs');
class TabDrags {
 constructor({alive,notify,ttl=30000,cancelDelay=2000}){this.alive=alive;this.notify=notify;this.ttl=ttl;this.cancelDelay=cancelDelay;this.entries=new Map();}
 remove(token){const entry=this.entries.get(token);if(entry){clearTimeout(entry.timer);clearTimeout(entry.cancelTimer);}this.entries.delete(token);}
 begin(source,token,state){if(typeof token!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)||this.entries.has(token)||!this.alive(source))throw Error('Invalid tab drag.');const data=validate(state,state?.path);if(!data)throw Error('Choose a tab to move.');const entry={source,state:data,claim:null};entry.timer=setTimeout(()=>this.remove(token),this.ttl);entry.timer.unref?.();this.entries.set(token,entry);return true;}
 take(destination,token){const entry=this.entries.get(token);if(!entry||entry.claim!==null||entry.source===destination||!this.alive(entry.source)||!this.alive(destination))throw Error('This tab drag is no longer available.');entry.claim=destination;clearTimeout(entry.cancelTimer);return structuredClone(entry.state);}
 finish(destination,token,success){const entry=this.entries.get(token);if(!entry)return false;if(entry.claim!==destination)throw Error('This tab belongs to another window.');this.remove(token);if(success&&this.alive(entry.source))this.notify(entry.source,token);return true;}
 cancel(source,token,immediate=false){const entry=this.entries.get(token);if(!entry)return;if(entry.source!==source)throw Error('This tab belongs to another window.');if(immediate&&entry.claim===null){this.remove(token);return;}entry.cancelTimer=setTimeout(()=>{if(this.entries.get(token)?.claim===null)this.remove(token);},this.cancelDelay);entry.cancelTimer.unref?.();}
 close(id){for(const [token,entry] of this.entries){if(entry.source===id)this.remove(token);else if(entry.claim===id){entry.claim=null;this.cancel(entry.source,token);}}}
}
module.exports={TabDrags};
