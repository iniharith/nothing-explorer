// A synchronous admission gate prevents new mutations after handoff begins.
class UpdateGate{
 constructor(){this.active=0;this.locked=false;}
 enter(){if(this.locked)throw Error('The workspace is being transferred to the updated app.');this.active++;let done=false;return ()=>{if(!done){done=true;this.active--;}};}
 freeze(){if(this.locked||this.active)throw Error('Finish file operations before switching versions.');this.locked=true;let done=false;return ()=>{if(!done){done=true;this.locked=false;}};}
}
module.exports={UpdateGate};
