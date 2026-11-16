function protectBrokenPipes(streams=[process.stdout,process.stderr]){for(const stream of new Set(streams)){if(!stream)continue;stream.on('error',error=>{if(error?.code!=='EPIPE')throw error;});}}
module.exports={protectBrokenPipes};
