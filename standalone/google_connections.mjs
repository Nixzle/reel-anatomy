/* Official Google OAuth in the browser. Tokens and YouTube responses are memory-only. */
export const SCOPES=Object.freeze({
  youtube:['https://www.googleapis.com/auth/youtube.readonly','https://www.googleapis.com/auth/yt-analytics.readonly'],
  drive:['https://www.googleapis.com/auth/drive.appdata']
});
const ID=/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/;
export function validClientId(value){if(typeof value!=='string'||value.length>250||!ID.test(value.trim()))throw Error('Enter this app\'s registered Google web client ID, not a secret, access token or another app\'s credentials.');return value.trim();}
export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export class GoogleSession{
  constructor({fetcher=globalThis.fetch,clock=()=>Date.now(),onClear=()=>{},documentObject=globalThis.document,googleObject=()=>globalThis.google}={}){
    this.fetcher=(...args)=>fetcher.call(globalThis,...args);this.clock=clock;this.onClear=onClear;this.document=documentObject;this.google=googleObject;
    this.tokens=new Map();this.controllers=new Set();this.clientId='';this.sdkPromise=null;this.pending=false;this.epoch=0;
  }
  configure(clientId){const clean=validClientId(clientId);if(this.clientId&&this.clientId!==clean)this.clear();this.clientId=clean;}
  has(service){const t=this.tokens.get(service);if(!t)return false;if(t.until<=this.clock()){this.clear(service);return false;}return true;}
  clear(service=null){this.epoch++;for(const c of this.controllers)c.abort();this.controllers.clear();
    for(const [kind,token]of this.tokens)if(!service||service===kind){clearTimeout(token.timer);this.tokens.delete(kind);}
    this.onClear(service);
  }
  async loadSdk(){
    if(!this.clientId)throw Error('Configure the registered OAuth client first.');
    if(this.google()?.accounts?.oauth2)return;
    if(this.sdkPromise)return this.sdkPromise;
    this.sdkPromise=new Promise((resolve,reject)=>{
      const script=this.document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.referrerPolicy='no-referrer';
      const timer=setTimeout(()=>{script.remove();this.sdkPromise=null;reject(Error('Google sign-in did not load. No account was connected.'));},20000);
      script.onload=()=>{clearTimeout(timer);if(this.google()?.accounts?.oauth2)resolve();else{this.sdkPromise=null;reject(Error('The expected Google authorisation library is unavailable.'));}};
      script.onerror=()=>{clearTimeout(timer);script.remove();this.sdkPromise=null;reject(Error('Google sign-in could not load. Offline research remains available.'));};
      this.document.head.append(script);
    });return this.sdkPromise;
  }
  connect(service){
    if(!SCOPES[service])return Promise.reject(Error('Unsupported account scope.'));
    if(!this.clientId||!this.google()?.accounts?.oauth2)return Promise.reject(Error('Load Google sign-in first, then select Connect.'));
    if(this.pending)return Promise.reject(Error('A sign-in request is already open.'));
    this.clear(service);this.pending=true;const epoch=this.epoch;
    return new Promise((resolve,reject)=>{
      let done=false;const finish=(error,response)=>{if(done)return;done=true;clearTimeout(timer);this.pending=false;error?reject(error):resolve(response);};
      const timer=setTimeout(()=>finish(Error('Sign-in did not complete. Close the popup before trying again.')),120000);
      const client=this.google().accounts.oauth2.initTokenClient({client_id:this.clientId,scope:SCOPES[service].join(' '),include_granted_scopes:false,
        callback:response=>{
          if(done||epoch!==this.epoch)return finish(Error('This sign-in request is no longer current.'));
          if(response.error||typeof response.access_token!=='string')return finish(Error('Google did not grant this access. Nothing was connected.'));
          const granted=new Set(String(response.scope||'').split(/\s+/));
          if(!SCOPES[service].every(scope=>granted.has(scope)))return finish(Error('Required read permissions were not granted. No data request was sent.'));
          const seconds=Number(response.expires_in);if(!Number.isFinite(seconds)||seconds<=30)return finish(Error('Google returned no usable token lifetime.'));
          const ttl=Math.min(seconds-20,3600)*1000;
          const token={value:response.access_token,until:this.clock()+ttl,timer:setTimeout(()=>this.clear(service),ttl)};this.tokens.set(service,token);
          finish(null,{service,expiresAt:token.until});
        },error_callback:()=>finish(Error('Google sign-in was cancelled or the popup was blocked.'))});
      try{client.requestAccessToken({prompt:'select_account'});}catch{finish(Error('Google sign-in could not be opened from this action.'));}
    });
  }
  async revoke(){
    const token=[...this.tokens.values()][0]?.value;
    if(!token){this.clear();return {revoked:false,reason:'No live token. Revoke from Google account permissions.'};}
    try{
      const result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Revocation was not confirmed. Use Google account permissions.')),15000);
        this.google().accounts.oauth2.revoke(token,value=>{clearTimeout(timer);value?.successful?resolve({revoked:true}):reject(Error('Google did not confirm revocation. Use Google account permissions.'));});});
      return result;
    }finally{this.clear();}
  }
  async request(service,path,{method='GET',body=null,headers={},signal,maxBytes=2_000_000}={}){
    if(!this.has(service))throw Error('Connect '+service+' again. Tokens expire and are never restored from storage.');
    let url;
    if(service==='youtube'){
      if(method!=='GET'||!/^\/(?:youtube\/v3\/(?:channels|playlistItems|videos)|analytics\/v2\/reports)(?:\?|$)/.test(path))throw Error('This connector only reads channel, video and Analytics reports.');
      url=path.startsWith('/analytics/')?'https://youtubeanalytics.googleapis.com'+path.replace('/analytics',''):'https://www.googleapis.com'+path;
    }else if(service==='drive'){
      if(!/^\/(?:drive\/v3\/(?:about|files(?:\/[A-Za-z0-9_-]+)?)|upload\/drive\/v3\/files)(?:\?|$)/.test(path)||!['GET','POST','DELETE'].includes(method))throw Error('Unsupported app-data action.');
      url='https://www.googleapis.com'+path;
    }else throw Error('Unknown provider.');
    if(path.includes('#')||path.includes('://')||/access_token|authorization/i.test(path)||Object.keys(headers).some(k=>k.toLowerCase()==='authorization'))throw Error('Credentials cannot be supplied through API URLs or custom headers.');
    const controller=new AbortController();this.controllers.add(controller);const epoch=this.epoch;
    const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
    const timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await this.fetcher(url,{method,body,headers:{Accept:'application/json',...headers,Authorization:'Bearer '+this.tokens.get(service).value},credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:controller.signal,cache:'no-store'});
      if(epoch!==this.epoch)throw Error('Account session changed during this request.');
      if(response.status===401){this.clear(service);throw new ApiError(401,'Access expired or was revoked. Sign in again; account data was cleared.');}
      if(!response.ok){const messages={403:'The service denied this request. Check approved scopes, API enablement and account ownership.',404:'The requested account resource no longer exists.',409:'This immutable file ID already exists. Reconcile it before retrying.',429:'The service rate limit was reached. No automatic retry was made.'};throw new ApiError(response.status,messages[response.status]||'Google returned HTTP '+response.status+'. No replacement data was invented.');}
      if(response.status===204)return null;
      const declared=Number(response.headers.get('content-length')||0);if(declared>maxBytes)throw Error('Provider response exceeded the size limit.');
      const reader=response.body?.getReader();let text;
      if(reader){const chunks=[];let bytes=0;for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes){await reader.cancel();throw Error('Provider response exceeded the size limit.');}chunks.push(value);}const data=new Uint8Array(bytes);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}text=new TextDecoder('utf-8',{fatal:true}).decode(data);}
      else{text=await response.text();if(new TextEncoder().encode(text).length>maxBytes)throw Error('Provider response exceeded the size limit.');}
      if(epoch!==this.epoch)throw Error('Account session changed during this request.');
      return JSON.parse(text);
    }finally{clearTimeout(timer);this.controllers.delete(controller);signal?.removeEventListener('abort',abort);}
  }
}
const channelId=value=>{if(typeof value!=='string'||!/^UC[A-Za-z0-9_-]{22}$/.test(value))throw Error('Invalid channel identity.');return value;};
const videoId=value=>{if(typeof value!=='string'||!/^[-_A-Za-z0-9]{11}$/.test(value))throw Error('Invalid video identity.');return value;};
const query=value=>new URLSearchParams(value).toString();
export function isoDuration(value){const m=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(value||'');return m?Number(m[1]||0)*3600+Number(m[2]||0)*60+Number(m[3]||0):null;}
export function tableResponse(data){
  if(!Array.isArray(data?.columnHeaders)||data.columnHeaders.length>20||!Array.isArray(data.rows||[])||(data.rows||[]).length>1000)throw Error('Analytics returned an unexpected report.');
  const columns=data.columnHeaders.map(c=>{if(typeof c.name!=='string'||c.name.length>100)throw Error('Invalid report column.');return c.name;});
  const rows=(data.rows||[]).map(row=>{if(!Array.isArray(row)||row.length!==columns.length||row.some(v=>typeof v!=='number'&&typeof v!=='string'||typeof v==='number'&&!Number.isFinite(v)))throw Error('Invalid report values.');return [...row];});
  return {columns,rows};
}
export class YouTubeIntake{
  constructor(session){this.session=session;this.channels=[];this.videos=new Map();}
  clear(){this.channels=[];this.videos.clear();}
  async loadChannels(){this.clear();const data=await this.session.request('youtube','/youtube/v3/channels?'+query({part:'snippet,contentDetails',mine:'true',maxResults:'50',fields:'items(id,snippet(title),contentDetails(relatedPlaylists(uploads)))'}));
    if(!Array.isArray(data.items)||data.items.length>50)throw Error('Unexpected channel response.');
    this.channels=data.items.map(c=>({id:channelId(c.id),title:String(c.snippet?.title||'Channel').slice(0,500),uploads:String(c.contentDetails?.relatedPlaylists?.uploads||'')}));return this.channels;
  }
  async loadVideos(id,pageToken=''){
    const channel=this.channels.find(c=>c.id===channelId(id));if(!channel)throw Error('Select a channel returned by your authorised account.');
    if(!/^[A-Za-z0-9_-]{10,100}$/.test(channel.uploads)||pageToken.length>500)throw Error('Invalid uploads pagination.');
    const result=await this.session.request('youtube','/youtube/v3/playlistItems?'+query({part:'contentDetails',playlistId:channel.uploads,maxResults:'50',...(pageToken?{pageToken}:{}),fields:'nextPageToken,items(contentDetails(videoId))'}));
    if(!Array.isArray(result.items)||result.items.length>50)throw Error('Unexpected uploads response.');
    const ids=result.items.map(x=>videoId(x.contentDetails?.videoId));let videos=[];
    if(ids.length){const detail=await this.session.request('youtube','/youtube/v3/videos?'+query({part:'snippet,contentDetails,statistics',id:ids.join(','),fields:'items(id,snippet(title,publishedAt,channelId),contentDetails(duration),statistics(viewCount,likeCount,commentCount))'}));
      if(!Array.isArray(detail.items))throw Error('Unexpected video response.');
      videos=detail.items.map(v=>{if(v.snippet?.channelId!==id||!ids.includes(v.id))throw Error('Video does not belong to the selected channel.');
        const counts={};for(const key of ['viewCount','likeCount','commentCount']){const n=v.statistics?.[key];if(n!==undefined){if(!/^\d{1,20}$/.test(n))throw Error('Unexpected platform count.');counts[key]=n;}}
        return {id:videoId(v.id),channelId:id,title:String(v.snippet.title||'Video').slice(0,500),publishedAt:String(v.snippet.publishedAt||''),duration:isoDuration(v.contentDetails?.duration),statistics:counts,observedAt:new Date().toISOString()};});
      for(const v of videos)this.videos.set(v.id,v);
    }return {videos,nextPageToken:String(result.nextPageToken||'').slice(0,500)};
  }
  async report(video,startDate,endDate,retention=false){
    const item=this.videos.get(videoId(video));if(!item)throw Error('Read this authorised channel video first.');
    const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
    if(!validDate(startDate)||!validDate(endDate)||startDate>endDate||Date.parse(endDate)-Date.parse(startDate)>366*86400000)throw Error('Choose a valid reporting window of at most 366 days.');
    const params={ids:'channel=='+item.channelId,startDate,endDate,filters:'video=='+item.id,
      ...(retention?{dimensions:'elapsedVideoTimeRatio',metrics:'audienceWatchRatio'}:{metrics:'views,engagedViews,likes,comments,shares,averageViewDuration'})};
    const table=tableResponse(await this.session.request('youtube','/analytics/v2/reports?'+query(params)));
    return {...table,channelId:item.channelId,videoId:item.id,startDate,endDate,observedAt:new Date().toISOString(),kind:retention?'retention':'summary',provenance:'YouTube Analytics API. Dates follow YouTube reporting periods, not an exact elapsed-age cohort.',scope:'This session only. No custom viral score, persistent import, assistant prompt or cloud sync.'};
  }
}
