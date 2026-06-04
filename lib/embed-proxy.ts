export const ALLOWED_PLAYER_HOST = "player.videasy.net";
export const PLAYER_BASE = "https://player.videasy.net/";

function progressScript(): string {
  return `(function(){
  var lastSentAt=0;
  function parsePositiveInt(value){
    var parsed=Number(value);
    return Number.isFinite(parsed)&&parsed>0?Math.floor(parsed):undefined;
  }
  function metadata(){
    try{
      var parts=location.pathname.split("/").filter(Boolean);
      var type=parts[0]==="tv"?"tv":"movie";
      return {
        source:"binje-player",
        type:type,
        id:parsePositiveInt(parts[1]),
        season:type==="tv"?parsePositiveInt(parts[2]):undefined,
        episode:type==="tv"?parsePositiveInt(parts[3]):undefined
      };
    }catch(e){
      return {source:"binje-player"};
    }
  }
  function report(video,force){
    try{
      var now=Date.now();
      if(!force&&now-lastSentAt<5000)return;
      if(!video||!Number.isFinite(video.currentTime)||!Number.isFinite(video.duration)||video.duration<=0)return;
      lastSentAt=now;
      parent.postMessage(Object.assign(metadata(),{
        event:"progress",
        positionSeconds:video.currentTime,
        durationSeconds:video.duration
      }),location.origin);
    }catch(e){}
  }
  function bind(video){
    if(!video||video.__binjeProgressBound)return;
    video.__binjeProgressBound=true;
    video.addEventListener("timeupdate",function(){report(video,false);},{passive:true});
    video.addEventListener("loadedmetadata",function(){report(video,true);},{passive:true});
    video.addEventListener("pause",function(){report(video,true);},{passive:true});
    video.addEventListener("ended",function(){report(video,true);},{passive:true});
    report(video,true);
  }
  function scan(){
    try{document.querySelectorAll("video").forEach(bind);}catch(e){}
  }
  scan();
  try{
    new MutationObserver(scan).observe(document,{childList:true,subtree:true});
  }catch(e){}
})();`;
}

function guardScript(spoofedPath: string): string {
  return `(function(){
  var PLAYER_HOST=${JSON.stringify(ALLOWED_PLAYER_HOST)};
  function isPlayerUrl(value){
    try{return new URL(value,document.baseURI||location.href).hostname===PLAYER_HOST;}
    catch(e){return false;}
  }
  function sameOriginPlayerUrl(value){
    try{
      if(value==null)return value;
      var url=new URL(value,location.href);
      if(url.hostname===PLAYER_HOST)return location.origin+url.pathname+url.search+url.hash;
      return url.origin===location.origin?url.href:location.href;
    }catch(e){return value;}
  }
  function proxiedPlayerUrl(value){
    try{
      if(value==null)return value;
      if(typeof value==="string"&&value.indexOf("/api/")===0)return location.origin+value;
      var url=new URL(value,document.baseURI||location.href);
      if(url.hostname==="api.videasy.net")return url.href;
      if(url.protocol==="http:"||url.protocol==="https:"){
        if(url.origin===location.origin)return url.href;
        return location.origin+"/api/hls?url="+encodeURIComponent(url.href);
      }
      return value;
    }catch(e){return value;}
  }
  try{
    var originalPushState=history.pushState.bind(history);
    var originalReplaceState=history.replaceState.bind(history);
    history.pushState=function(state,title,url){return originalPushState(state,title,sameOriginPlayerUrl(url));};
    history.replaceState=function(state,title,url){return originalReplaceState(state,title,sameOriginPlayerUrl(url));};
    history.replaceState(null,"",${JSON.stringify(spoofedPath)});
  }catch(e){}
  try{
    var originalFetch=window.fetch.bind(window);
    window.fetch=function(input,init){
      if(typeof input==="string"||input instanceof URL){
        return originalFetch(proxiedPlayerUrl(String(input)),init);
      }
      try{
        var rewritten=proxiedPlayerUrl(input.url);
        if(rewritten!==input.url)input=new Request(rewritten,input);
      }catch(e){}
      return originalFetch(input,init);
    };
  }catch(e){}
  try{
    var originalXhrOpen=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url){
      arguments[1]=proxiedPlayerUrl(url);
      return originalXhrOpen.apply(this,arguments);
    };
  }catch(e){}
  try{
    Object.defineProperty(window,"open",{value:function(){return null;},writable:false,configurable:false});
  }catch(e){try{window.open=function(){return null};}catch(e2){}}
  function blockExternalClick(event){
    var target=event.target&&event.target.closest?event.target.closest("a,form,area"):null;
    if(!target)return;
    var href=target.getAttribute("href")||target.getAttribute("action")||"";
    if((target.target&&target.target!=="_self")||(href&&!isPlayerUrl(href))){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }
  ["click","auxclick","submit"].forEach(function(type){
    try{document.addEventListener(type,blockExternalClick,true);}catch(e){}
  });
  function scrubNode(node){
    if(!node||node.nodeType!==1)return;
    if(node.tagName==="SCRIPT"){
      var src=node.getAttribute("src")||"";
      if(src&&!isPlayerUrl(src)){try{node.remove();}catch(e){}return;}
    }
    if(node.matches&&node.matches("a[target],form[target],area[target],base[target]")&&node.getAttribute("target")!=="_self"){
      node.setAttribute("target","_self");
    }
    if(!node.querySelectorAll)return;
    node.querySelectorAll("script[src]").forEach(function(script){
      if(!isPlayerUrl(script.getAttribute("src")||""))script.remove();
    });
    node.querySelectorAll("a[target],form[target],area[target],base[target]").forEach(function(el){
      if(el.getAttribute("target")!=="_self")el.setAttribute("target","_self");
    });
  }
  scrubNode(document.documentElement);
  try{
    new MutationObserver(function(records){
      records.forEach(function(record){
        if(record.type==="childList"){
          record.addedNodes.forEach(scrubNode);
        }else if(record.type==="attributes"){
          scrubNode(record.target);
        }
      });
    }).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:["src","target"]});
  }catch(e){}
  try{
    var originalCreate=document.createElement.bind(document);
    document.createElement=function(tag){
      var el=originalCreate.apply(this,arguments);
      if(String(tag).toLowerCase()==="script"){
        var originalSetAttribute=el.setAttribute.bind(el);
        el.setAttribute=function(name,value){
          if(String(name).toLowerCase()==="src"&&value&&!isPlayerUrl(value))return;
          return originalSetAttribute(name,value);
        };
      }
      return el;
    };
  }catch(e){}
  try{
    var scriptSrc=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,"src");
    if(scriptSrc&&scriptSrc.set){
      Object.defineProperty(HTMLScriptElement.prototype,"src",{
        configurable:true,
        get:scriptSrc.get,
        set:function(value){if(isPlayerUrl(value))return scriptSrc.set.call(this,value);}
      });
    }
  }catch(e){}
})();`;
}

export function rewriteEmbedHtml(
  html: string,
  spoofedPath: string,
  base: string = PLAYER_BASE,
): string {
  const out = html
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(
      /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi,
      (match, src: string) => {
        try {
          return new URL(src, base).hostname === ALLOWED_PLAYER_HOST ? match : "";
        } catch {
          return "";
        }
      },
    )
    .replace(/\btarget\s*=\s*["']?_(blank|new)["']?/gi, 'target="_self"');

  const injection = `<base href="${base}"><script>${guardScript(spoofedPath)}</script><script>${progressScript()}</script>`;
  return /<head[^>]*>/i.test(out)
    ? out.replace(/<head[^>]*>/i, (match) => match + injection)
    : injection + out;
}
