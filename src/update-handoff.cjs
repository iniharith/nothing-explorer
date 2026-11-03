// Coordinate a staged update without closing the existing workspace on failure.
// Platform-specific staging, workspace transfer and process launch are injected.
class UpdateHandoff {
 constructor({busy,snapshot,stage,launch,ready,activate,retire,discard,freeze=async()=>()=>{},report=()=>{}}){Object.assign(this,{busy,snapshot,stage,launch,ready,activate,retire,discard,freeze,report});this.running=false;}
 async run(release){
  if(this.running)throw Error('An update handoff is already in progress.');
  this.running=true;let candidate=null,activated=false,unfreeze=null;
  try{
   if(await this.busy())throw Error('Finish file operations before switching versions.');
   this.report('preparing');const staged=await this.stage(release);
   unfreeze=await this.freeze();if(typeof unfreeze!=='function')throw Error('Could not lock the workspace for the update.');
   if(await this.busy())throw Error('File operations started while preparing the update.');
   const workspace=await this.snapshot();
   this.report('starting');candidate=await this.launch(staged,workspace);
   await this.ready(candidate);
   if(await this.busy())throw Error('File operations started before the new window was ready.');
   this.report('switching');await this.activate(candidate);activated=true;
   await this.retire();this.report('complete');return {status:'complete'};
  }catch(error){if(candidate&&!activated)try{await this.discard(candidate);}catch(cleanup){error.message+=' Recovery needs attention: '+cleanup.message;}if(unfreeze&&!activated)try{await unfreeze();}catch(cleanup){error.message+=' Could not re-enable a window: '+cleanup.message;}if(activated)error.message+=' The updated app is active; the old workspace remains locked to protect file history.';this.report('failed',error.message);throw error;}
  finally{this.running=false;}
 }
}
module.exports={UpdateHandoff};
