(function(root){
 const interval=1000/60,subscribers=new Set();let handle=0,last=-1,next=0,inTick=false;
 const stats={target:60,frames:0,maxWorkMs:0};
 function tick(time){handle=0;inTick=true;if(last<0||time+1>=next){const dt=last<0?interval:Math.min(50,time-last);if(last<0)next=time;last=time;next+=interval;if(next<time-interval)next=time+interval;const start=performance.now();for(const fn of [...subscribers])if(fn(time,dt)===false)subscribers.delete(fn);stats.frames++;stats.maxWorkMs=Math.max(stats.maxWorkMs,performance.now()-start);}inTick=false;if(subscribers.size)handle=requestAnimationFrame(tick);else{last=-1;next=0;}}
 const clock={stats,subscribe(fn){subscribers.add(fn);if(!handle&&!inTick)handle=requestAnimationFrame(tick);return ()=>subscribers.delete(fn);},once(fn){return clock.subscribe((t,dt)=>{fn(t,dt);return false;});}};
 root.FrameClock=clock;
})(globalThis);
