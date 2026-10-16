/** One drain for signals and fatal errors; a fatal exit always remains non-zero. */
export function installShutdown(runtime:Pick<NodeJS.Process,'on'|'once'|'exit'>,drain:()=>Promise<void>,log:(...args:unknown[])=>void=console.error){
 let running:Promise<void>|undefined,exitCode=0;
 const stop=(code:number,error?:unknown)=>{exitCode=Math.max(code,exitCode);if(error)log('Fatal server error',error);if(running)return running;
  running=(async()=>{const timeout=setTimeout(()=>runtime.exit(1),10000);timeout.unref();try{await drain();}catch(error){exitCode=1;log('Shutdown failed',error);}finally{clearTimeout(timeout);runtime.exit(exitCode);}})();return running;};
 for(const signal of ['SIGTERM','SIGINT'])runtime.once(signal,()=>{void stop(0);});
 runtime.on('unhandledRejection',error=>{void stop(1,error);});runtime.on('uncaughtException',error=>{void stop(1,error);});return stop;
}
