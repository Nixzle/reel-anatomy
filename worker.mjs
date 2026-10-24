import { loadPyodide } from './runtime/pyodide.mjs';
let python;
const ready = (async () => {
  python = await loadPyodide({indexURL:new URL('./runtime/',import.meta.url).href});
  await python.loadPackage('sqlite3');
  for (const name of ['studio_store.py','embedded_core.py','embedded_csv.py','research_engine.py','factory_engine.py','release_services.py','creative_lab.py','backend.py']) {
    const r = await fetch(new URL('./python/'+name,import.meta.url));
    if (!r.ok) throw Error('Application code could not be loaded: '+name);
    python.FS.writeFile('/home/pyodide/'+name,await r.text());
  }
  python.runPython('from backend import handle');
})();
let chain = Promise.resolve();
self.onmessage = event => {
  const {id,request}=event.data;
  chain = chain.catch(()=>{}).then(async()=>{
    try {
      await ready;
      python.globals.set('request_json',JSON.stringify(request));
      const result=JSON.parse(python.runPython('handle(request_json)'));
      self.postMessage({id,...result});
    } catch(error) {self.postMessage({id,ok:false,error:'On-device engine: '+String(error)});}
  });
};
