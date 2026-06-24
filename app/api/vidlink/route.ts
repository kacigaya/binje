import { NextRequest, NextResponse } from "next/server";
import { Resolver } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";

const ALLOWED_HOST = "vidlink.pro";
const PLAYER_BASE = `https://${ALLOWED_HOST}/`;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const FETCH_TIMEOUT_MS = 12000;
const MAX_REDIRECTS = 4;

export const runtime = "nodejs";
export const maxDuration = 20;

const resolver = new Resolver();
resolver.setServers(["1.1.1.1", "8.8.8.8"]);

function getVidlinkUrl(value: string | null): URL | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.hostname !== ALLOWED_HOST) return null;
    return url;
  } catch {
    return null;
  }
}

function lookup(
  hostname: string,
  options: { all?: boolean } | undefined,
  callback: (
    error: NodeJS.ErrnoException | null,
    address: string | { address: string; family: number }[],
    family?: number,
  ) => void,
) {
  resolver.resolve4(hostname).then(
    (addresses) => {
      if (options?.all) {
        callback(
          null,
          addresses.map((address) => ({ address, family: 4 })),
        );
      } else {
        callback(null, addresses[0], 4);
      }
    },
    (error: NodeJS.ErrnoException) => callback(error, "", 4),
  );
}

function proxiedUrl(url: string | URL) {
  return `/api/vidlink?url=${encodeURIComponent(String(url))}`;
}

function guardScript(spoofedPath: string) {
  return `(function(){
  var PLAYER_HOST=${JSON.stringify(ALLOWED_HOST)};
  function toUrl(value){
    try{
      if(typeof value==="string"&&value.indexOf("/api/vidlink")===0)return new URL(value,location.origin);
      if(typeof value==="string"&&/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value))return new URL(value);
      if(typeof value==="string"&&value.charAt(0)==="/")return new URL(value,${JSON.stringify(PLAYER_BASE)});
      return new URL(value,${JSON.stringify(PLAYER_BASE)});
    }catch(e){return null;}
  }
  function isPlayerUrl(value){
    var url=toUrl(value);
    return !!url&&url.hostname===PLAYER_HOST;
  }
  function proxiedPlayerUrl(value){
    var url=toUrl(value);
    if(!url)return value;
    if(url.origin===location.origin)return url.href;
    if(url.hostname===PLAYER_HOST)return location.origin+"/api/vidlink?url="+encodeURIComponent(url.href);
    return "about:blank";
  }
  function proxiedNetworkUrl(value){
    var url=toUrl(value);
    if(!url)return value;
    if(url.origin===location.origin)return url.href;
    if(url.protocol==="http:"||url.protocol==="https:"){
      if(url.hostname===PLAYER_HOST)return proxiedPlayerUrl(url.href);
      return location.origin+"/api/hls?url="+encodeURIComponent(url.href);
    }
    return value;
  }
  try{
    var originalPushState=history.pushState.bind(history);
    var originalReplaceState=history.replaceState.bind(history);
    history.pushState=function(state,title,url){return originalPushState(state,title,url==null?url:${JSON.stringify(spoofedPath)});};
    history.replaceState=function(state,title,url){return originalReplaceState(state,title,url==null?url:${JSON.stringify(spoofedPath)});};
    history.replaceState(null,"",${JSON.stringify(spoofedPath)});
  }catch(e){}
  try{
    Object.defineProperty(window,"open",{value:function(){return null;},writable:false,configurable:false});
  }catch(e){try{window.open=function(){return null};}catch(e2){}}
  try{
    var originalFetch=window.fetch.bind(window);
    window.fetch=function(input,init){
      if(typeof input==="string"||input instanceof URL){
        return originalFetch(proxiedNetworkUrl(String(input)),init);
      }
      try{
        var rewritten=proxiedNetworkUrl(input.url);
        if(rewritten!==input.url)input=new Request(rewritten,input);
      }catch(e){}
      return originalFetch(input,init);
    };
  }catch(e){}
  try{
    var originalXhrOpen=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url){
      arguments[1]=proxiedNetworkUrl(url);
      return originalXhrOpen.apply(this,arguments);
    };
  }catch(e){}
  function blockExternalClick(event){
    var target=event.target&&event.target.closest?event.target.closest("a,form,area"):null;
    if(!target)return;
    var href=target.getAttribute("href")||target.getAttribute("action")||"";
    if((target.target&&target.target!=="_self")||(href&&!isPlayerUrl(href)&&!href.startsWith(location.origin))){
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
      if(src){
        if(isPlayerUrl(src))node.setAttribute("src",proxiedPlayerUrl(src));
        else if((node.tagName==="SOURCE"||node.tagName==="VIDEO"||node.tagName==="TRACK")&&/^https?:/i.test(src))node.setAttribute("src",proxiedNetworkUrl(src));
        else if(src.indexOf("/api/vidlink")!==0&&!src.startsWith(location.origin)){try{node.remove();}catch(e){}return;}
      }
    }
    if(node.matches&&node.matches("a[target],form[target],area[target],base[target]")&&node.getAttribute("target")!=="_self"){
      node.setAttribute("target","_self");
    }
    if(!node.querySelectorAll)return;
    node.querySelectorAll("script[src]").forEach(scrubNode);
    node.querySelectorAll("a[target],form[target],area[target],base[target]").forEach(scrubNode);
  }
  try{scrubNode(document.documentElement);}catch(e){}
  try{
    new MutationObserver(function(records){
      records.forEach(function(record){
        if(record.type==="childList")record.addedNodes.forEach(scrubNode);
        else if(record.type==="attributes")scrubNode(record.target);
      });
    }).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:["src","target"]});
  }catch(e){}
  try{
    var originalCreate=document.createElement.bind(document);
    document.createElement=function(tag){
      var el=originalCreate.apply(this,arguments);
      if(["script","source","video","track"].indexOf(String(tag).toLowerCase())!==-1){
        var originalSetAttribute=el.setAttribute.bind(el);
        el.setAttribute=function(name,value){
          if(String(name).toLowerCase()==="src"){
            if(isPlayerUrl(value))return originalSetAttribute.call(this,name,proxiedPlayerUrl(value));
            if(String(tag).toLowerCase()==="script"){
              if(value&&!String(value).startsWith(location.origin))return;
            }else if(value&&/^https?:/i.test(String(value))){
              return originalSetAttribute.call(this,name,proxiedNetworkUrl(value));
            }
          }
          return originalSetAttribute.apply(this,arguments);
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
        set:function(value){
          if(isPlayerUrl(value))return scriptSrc.set.call(this,proxiedPlayerUrl(value));
          if(value&&String(value).indexOf(location.origin)!==0&&String(value).indexOf("/api/")!==0)return;
          return scriptSrc.set.call(this,value);
        }
      });
    }
  }catch(e){}
  try{
    var mediaSrc=Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,"src");
    if(mediaSrc&&mediaSrc.set){
      Object.defineProperty(HTMLMediaElement.prototype,"src",{
        configurable:true,
        get:mediaSrc.get,
        set:function(value){
          if(value&&/^https?:/i.test(String(value)))return mediaSrc.set.call(this,proxiedNetworkUrl(value));
          return mediaSrc.set.call(this,value);
        }
      });
    }
  }catch(e){}
  try{
    var sourceSrc=Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype,"src");
    if(sourceSrc&&sourceSrc.set){
      Object.defineProperty(HTMLSourceElement.prototype,"src",{
        configurable:true,
        get:sourceSrc.get,
        set:function(value){
          if(value&&/^https?:/i.test(String(value)))return sourceSrc.set.call(this,proxiedNetworkUrl(value));
          return sourceSrc.set.call(this,value);
        }
      });
    }
  }catch(e){}
})();`;
}

function rewriteHtml(html: string, target: URL) {
  const spoofedPath = `${target.pathname}${target.search}${target.hash}`;

  const rewritten = html
    .replace(/<meta[^>]+http-equiv=["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(
      /(<script\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>\s*<\/script>)/gi,
      (match, prefix: string, src: string, suffix: string) => {
        try {
          const url = new URL(src, PLAYER_BASE);
          return url.hostname === ALLOWED_HOST
            ? `${prefix}${proxiedUrl(url)}${suffix}`
            : "";
        } catch {
          return "";
        }
      },
    )
    .replace(
      /(<link\b[^>]*\bhref=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix: string, href: string, suffix: string) => {
        try {
          const url = new URL(href, PLAYER_BASE);
          if (url.hostname !== ALLOWED_HOST) return match;
          return `${prefix}${proxiedUrl(url)}${suffix}`;
        } catch {
          return match;
        }
      },
    )
    .replace(
      /(<(?:img|source|track)\b[^>]*\bsrc=["'])([^"']+)(["'][^>]*>)/gi,
      (match, prefix: string, src: string, suffix: string) => {
        try {
          const url = new URL(src, PLAYER_BASE);
          if (url.hostname !== ALLOWED_HOST) return match;
          return `${prefix}${proxiedUrl(url)}${suffix}`;
        } catch {
          return match;
        }
      },
    )
    .replace(/\btarget\s*=\s*["']?_(blank|new)["']?/gi, 'target="_self"');

  const injection = `<script>${guardScript(spoofedPath)}</script>`;

  const out = rewriteTextAsset(rewritten);

  return /<head[^>]*>/i.test(out)
    ? out.replace(/<head[^>]*>/i, (match) => match + injection)
    : injection + out;
}

function rewriteTextAsset(text: string) {
  return text.replaceAll(
    "/_next/",
    `/api/vidlink?url=${encodeURIComponent(`${PLAYER_BASE}_next/`)}`,
  );
}

function fetchBuffer(target: URL, request: NextRequest, redirects = 0) {
  return new Promise<{
    body: Buffer;
    headers: Headers;
    status: number;
    url: URL;
  }>((resolve, reject) => {
    const requestFn = target.protocol === "http:" ? httpRequest : httpsRequest;
    const timeout = setTimeout(() => {
      req.destroy(new Error("Upstream request timed out."));
    }, FETCH_TIMEOUT_MS);

    const req = requestFn(
      target,
      {
        lookup,
        headers: {
          accept: request.headers.get("accept") ?? "*/*",
          referer: PLAYER_BASE,
          "user-agent": request.headers.get("user-agent") ?? BROWSER_USER_AGENT,
        },
      },
      (response) => {
        const status = response.statusCode ?? 502;
        const location = response.headers.location;

        if (status >= 300 && status < 400 && location) {
          clearTimeout(timeout);
          response.resume();

          if (redirects >= MAX_REDIRECTS) {
            reject(new Error("Too many redirects."));
            return;
          }

          const next = getVidlinkUrl(new URL(location, target).toString());
          if (!next) {
            reject(new Error("Blocked redirect target."));
            return;
          }

          fetchBuffer(next, request, redirects + 1).then(resolve, reject);
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          clearTimeout(timeout);
          resolve({
            body: Buffer.concat(chunks),
            headers: new Headers(
              Object.entries(response.headers).flatMap<[string, string]>(
                ([key, value]) => {
                  if (Array.isArray(value)) {
                    return value.map((item): [string, string] => [key, item]);
                  }
                  return value ? ([[key, value]] as [string, string][]) : [];
                },
              ),
            ),
            status,
            url: target,
          });
        });
      },
    );

    req.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    req.end();
  });
}

export async function GET(request: NextRequest) {
  const target = getVidlinkUrl(request.nextUrl.searchParams.get("url"));

  if (!target) {
    return NextResponse.json(
      { error: "Invalid or disallowed VidLink URL." },
      { status: 400 },
    );
  }

  let upstream: Awaited<ReturnType<typeof fetchBuffer>>;
  try {
    upstream = await fetchBuffer(target, request);
  } catch {
    return NextResponse.json(
      { error: "Failed to load VidLink player." },
      { status: 502 },
    );
  }

  if (upstream.status < 200 || upstream.status >= 300) {
    return NextResponse.json(
      { error: "VidLink upstream error." },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  const headers = new Headers({
    "cache-control": "no-store",
    "content-type": contentType || "application/octet-stream",
  });

  if (contentType.includes("text/html")) {
    headers.set("content-type", "text/html; charset=utf-8");
    headers.set("content-security-policy", "frame-ancestors 'self';");
    return new NextResponse(rewriteHtml(upstream.body.toString("utf8"), target), {
      status: 200,
      headers,
    });
  }

  if (
    contentType.includes("javascript") ||
    contentType.includes("text/css") ||
    contentType.includes("application/json")
  ) {
    return new NextResponse(rewriteTextAsset(upstream.body.toString("utf8")), {
      status: 200,
      headers,
    });
  }

  return new NextResponse(new Uint8Array(upstream.body), {
    status: 200,
    headers,
  });
}
