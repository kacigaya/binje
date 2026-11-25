import vm from "node:vm";
import { Window } from "happy-dom";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SERVER_TIMEOUT = 7000;
const NEXT_SERVER_WAIT = 4500;
const STREAM_POLL = 30;
const RELAY_SOFT_LIMIT = 30;
const RELAY_PER_SERVER = 7;
const TOTAL_TIMEOUT = 10000;
const SCRIPT_CACHE_LIMIT = 60;
const scriptCache = new Map();
let relayCalls = 0;
function countFetch(url) {
    relayCalls++;
    return fetch(url, { headers: { "User-Agent": UA } });
}
export function patchPlayerChunk(code) {
    const head = 'function H(e){if(!e||"object"!=typeof e)return;';
    const i = code.indexOf(head);
    if (i === -1)
        return code;
    return code.slice(0, i) + 'function H(e){try{window.__vidcoreMerge&&window.__vidcoreMerge(e)}catch(_){};' + head.slice("function H(e){".length) + code.slice(i + head.length);
}
export function refHooksForVideo(hooks) {
    return hooks
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => h && !h.state && h.current === null)
        .map(({ i }) => i);
}
function getScript(url) {
    if (!scriptCache.has(url)) {
        const p = countFetch(url)
            .then((r) => {
            if (!r.ok)
                throw new Error("chunk " + r.status);
            return r.text();
        })
            .then((code) => new vm.Script(patchPlayerChunk(code), { filename: url }));
        p.catch(() => scriptCache.delete(url));
        scriptCache.set(url, p);
        if (scriptCache.size > SCRIPT_CACHE_LIMIT)
            scriptCache.delete(scriptCache.keys().next().value);
    }
    return scriptCache.get(url);
}
function parsePage(html) {
    let flight = "";
    for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
        try {
            flight += JSON.parse(m[1]);
        }
        catch { }
    }
    const lines = flight.split("\n");
    const propsLine = lines.find((l) => l.includes('"en":"'));
    if (!propsLine)
        throw new Error("no player props");
    const ref = /"\$L([0-9a-f]+)"/.exec(propsLine)?.[1];
    const props = JSON.parse(propsLine.slice(propsLine.indexOf(":") + 1))[3];
    for (const k of Object.keys(props))
        if (props[k] === "$undefined")
            props[k] = undefined;
    const modLine = lines.find((l) => l.startsWith(ref + ":I["));
    if (!modLine)
        throw new Error("no player module ref");
    const modId = JSON.parse(modLine.slice(modLine.indexOf(":") + 2))[0];
    const srcs = [...new Set([...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]))];
    const chunks = srcs.filter((c) => !/\/(webpack|main-app|polyfills)-/.test(c));
    const runtime = srcs.find((c) => /\/webpack-/.test(c));
    return { props, modId, chunks, runtime };
}
export function playerVariants(src) {
    const out = new Map();
    for (const m of src.matchAll(/(?:"([^"]+)"|([\w$-]+)):\w+\(\)\(\(\)=>Promise\.all\(\[([^\]]*)\]\)\.then\(\w+\.bind\(\w+,(\d+)\)/g)) {
        out.set(m[1] ?? m[2], { chunks: [...m[3].matchAll(/\.e\((\d+)\)/g)].map((c) => Number(c[1])), mod: Number(m[4]) });
    }
    return out;
}
const chunkNamers = new Map();
function chunkNamer(url) {
    if (!chunkNamers.has(url)) {
        const p = countFetch(url)
            .then((r) => {
            if (!r.ok)
                throw new Error("runtime " + r.status);
            return r.text();
        })
            .then((code) => {
            const m = /\b(\w+)\.u=(\w+)=>(.+?),\1\.miniCssF=/.exec(code);
            if (!m)
                throw new Error("chunk namer not found");
            return vm.runInNewContext(`(${m[2]})=>${m[3]}`, {}, { timeout: 1000 });
        });
        p.catch(() => chunkNamers.delete(url));
        chunkNamers.set(url, p);
        if (chunkNamers.size > 6)
            chunkNamers.delete(chunkNamers.keys().next().value);
    }
    return chunkNamers.get(url);
}
function nativeLike(name) {
    return Object.defineProperty(function () { }.bind(null), "name", { value: name });
}
function makeFakeReact(onChange) {
    const st = { hooks: [], i: 0, effects: [] };
    const changed = (a, b) => !a || !b || a.length !== b.length || a.some((x, i) => !Object.is(x, b[i]));
    const R = {
        useState(init) {
            const i = st.i++;
            if (!(i in st.hooks))
                st.hooks[i] = { v: typeof init === "function" ? init() : init, state: true };
            const h = st.hooks[i];
            if (!h.set)
                h.set = (nv) => {
                    const v = typeof nv === "function" ? nv(h.v) : nv;
                    if (!Object.is(v, h.v)) {
                        h.v = v;
                        onChange();
                    }
                };
            return [h.v, h.set];
        },
        useReducer(red, init, f) {
            const [s, set] = R.useState(f ? () => f(init) : init);
            return [s, (a) => set((p) => red(p, a))];
        },
        useRef(init) {
            const i = st.i++;
            if (!(i in st.hooks))
                st.hooks[i] = { current: init };
            return st.hooks[i];
        },
        useMemo(f, d) {
            const i = st.i++;
            if (!st.hooks[i] || changed(st.hooks[i].d, d))
                st.hooks[i] = { v: f(), d };
            return st.hooks[i].v;
        },
        useCallback: (f, d) => R.useMemo(() => f, d),
        useEffect(f, d) {
            const i = st.i++;
            const old = st.hooks[i];
            if (old && !changed(old.d, d))
                return;
            st.hooks[i] = { d };
            st.effects.push(() => {
                try {
                    old?.c?.();
                }
                catch { }
                try {
                    const c = f();
                    st.hooks[i].c = typeof c === "function" ? c : null;
                }
                catch { }
            });
        },
        useContext(ctx) {
            return ctx && typeof ctx === "object" ? ctx._currentValue : undefined;
        },
        useId: () => ":r0:",
        useSyncExternalStore: (_s, get) => get(),
        useTransition: () => [false, (f) => f()],
        useDeferredValue: (v) => v,
        useImperativeHandle() { },
        useDebugValue() { },
        useInsertionEffect() { },
        createContext(v) {
            const ctx = { _currentValue: v, _defaultValue: v };
            ctx.Provider = { $$ctx: ctx };
            ctx.Consumer = { $$consumer: ctx };
            return ctx;
        },
        forwardRef: (f) => f,
        memo: (f) => f,
        lazy: (f) => f,
        createElement: () => null,
        cloneElement: () => null,
        isValidElement: () => false,
        startTransition: (f) => f(),
        Children: { map: () => [], forEach() { }, toArray: () => [], count: () => 0, only: (x) => x },
        Fragment: "f",
        Suspense: "s",
        Component: class {
        },
        PureComponent: class {
        },
    };
    R.useLayoutEffect = R.useEffect;
    return { R, st };
}
export async function* candidates(type, id, season, episode, signal) {
    relayCalls = 0;
    const base = "https://vidcore.io";
    const isTV = type === "tv";
    const path = isTV ? `/tv/${id}/${season}/${episode}` : `/movie/${id}`;
    const pageResp = await countFetch(base + path);
    if (!pageResp.ok)
        throw new Error("page " + pageResp.status);
    let { props, modId, chunks, runtime } = parsePage(await pageResp.text());
    const scripts = await Promise.all(chunks.map((c) => getScript(base + c)));
    const win = new Window({ url: base + path, width: 1280, height: 720 });
    const timers = new Set();
    let closed = false;
    const videoRefs = new Set();
    const ctx = {};
    for (const k of Object.getOwnPropertyNames(globalThis)) {
        try {
            ctx[k] = globalThis[k];
        }
        catch { }
    }
    const hostKeys = new Set(Object.getOwnPropertyNames(globalThis));
    for (const k of Object.getOwnPropertyNames(win)) {
        if (!hostKeys.has(k)) {
            try {
                ctx[k] = win[k];
            }
            catch { }
        }
    }
    Object.assign(ctx, {
        window: ctx,
        self: ctx,
        globalThis: ctx,
        top: ctx,
        parent: { postMessage() { } },
        document: win.document,
        location: win.location,
        localStorage: win.localStorage,
        sessionStorage: win.sessionStorage,
        screen: win.screen,
        innerWidth: 1280,
        innerHeight: 720,
        addEventListener() { },
        removeEventListener() { },
        postMessage() { },
        open: () => null,
        __vidcoreMerge: (obj) => {
            const ref = obj?.videoRef;
            if (ref && typeof ref === "object" && "current" in ref)
                videoRefs.add(ref);
        },
        MediaSource: class MediaSource {
            constructor() {
                this.readyState = "closed";
                this.duration = NaN;
                this.sourceBuffers = [];
                this.activeSourceBuffers = [];
            }
            static isTypeSupported(type) {
                return typeof type === "string" && /mpegurl|mp4|mp2t/i.test(type);
            }
            addSourceBuffer() {
                return { abort() { }, addEventListener() { }, appendBuffer() { }, remove() { }, setTimestampOffset() { }, removeEventListener() { }, mode: "segments", updating: false, buffered: { length: 0 } };
            }
            removeSourceBuffer() { }
            addEventListener() { }
            removeEventListener() { }
            endOfStream() { }
            setDuration() { }
        },
        WebKitMediaSource: undefined,
        ManagedMediaSource: undefined,
        XMLHttpRequest: class {
            open() { }
            send() {
                setTimeout(() => this.onerror?.(new Error("blocked")), 0);
            }
            setRequestHeader() { }
            abort() { }
            addEventListener() { }
        },
        navigator: {
            userAgent: UA,
            platform: "Win32",
            vendor: "Google Inc.",
            language: "en-US",
            languages: ["en-US"],
            maxTouchPoints: 0,
            cookieEnabled: true,
            onLine: true,
            plugins: { length: 0, namedItem: () => null, item: () => null },
            sendBeacon: () => true,
        },
        console: {
            log() { },
            warn() { },
            error() { },
            info() { },
            debug() { },
            dir() { },
            trace() { },
            group() { },
            groupEnd() { },
            time() { },
            timeEnd() { },
            table: nativeLike("table"),
            clear: nativeLike("clear"),
        },
        setTimeout: (f, ms, ...a) => {
            const id = setTimeout(() => {
                timers.delete(id);
                if (!closed)
                    f(...a);
            }, ms);
            timers.add(id);
            return id;
        },
        setInterval: (f, ms, ...a) => {
            const id = setInterval(() => !closed && f(...a), Math.max(ms || 0, 50));
            timers.add(id);
            return id;
        },
        clearTimeout: (id) => (timers.delete(id), clearTimeout(id)),
        clearInterval: (id) => (timers.delete(id), clearInterval(id)),
        fetch: (input, opts = {}) => {
            if (closed)
                return new Promise(() => { });
            let url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
            if (url.startsWith("/"))
                url = base + url;
            relayCalls++;
            if (new URL(url).origin !== base || /\/wyzie\b/.test(url))
                return Promise.resolve(new Response("", { status: 404 }));
            const h = new Headers(opts.headers);
            h.set("User-Agent", UA);
            h.set("Referer", base + path);
            h.set("Origin", base);
            const reqOpts = { ...opts, headers: h };
            return fetch(url, { ...reqOpts, signal: AbortSignal.timeout(SERVER_TIMEOUT) })
                .catch(() => new Response("", { status: 504 }));
        },
        webpackChunk_N_E: [],
    });
    const teardown = () => {
        closed = true;
        for (const id of timers) {
            clearTimeout(id);
            clearInterval(id);
        }
        timers.clear();
        try {
            win.happyDOM?.abort?.();
        }
        catch { }
        try {
            win.close();
        }
        catch { }
    };
    try {
        const vmCtx = vm.createContext(ctx);
        const runAll = (list) => {
            for (const s of list) {
                try {
                    s.runInContext(vmCtx, { timeout: 15000 });
                }
                catch { }
            }
        };
        runAll(scripts);
        const modules = {};
        const collect = () => {
            for (const entry of ctx.webpackChunk_N_E)
                Object.assign(modules, entry[1]);
        };
        collect();
        if (!modules[modId])
            throw new Error("player module missing");
        const { artifact, ...rest } = props;
        const variant = playerVariants(modules[modId].toString()).get(artifact);
        if (variant) {
            if (!runtime)
                throw new Error("no webpack runtime");
            const name = await chunkNamer(base + runtime);
            const paths = variant.chunks.map((id) => "/_next/" + name(id)).filter((p) => !/undefined/.test(p) && !chunks.includes(p));
            const extra = await Promise.allSettled(paths.map((p) => getScript(base + p)));
            runAll(extra.filter((r) => r.status === "fulfilled").map((r) => r.value));
            collect();
            if (!modules[variant.mod])
                throw new Error("player variant module missing");
            modId = variant.mod;
            props = rest;
        }
        let scheduled = false;
        let renders = 0;
        const { R, st } = makeFakeReact(() => {
            if (scheduled || closed)
                return;
            scheduled = true;
            setTimeout(() => {
                scheduled = false;
                if (!closed && renders < 200)
                    render();
            }, 0);
        });
        const JSX = { jsx: () => null, jsxs: () => null, Fragment: "f" };
        const nav = {
            useRouter: () => ({ push() { }, replace() { }, prefetch() { }, back() { }, refresh() { } }),
            useSearchParams: () => new URLSearchParams(""),
            usePathname: () => path,
            useParams: () => ({}),
        };
        const cache = {};
        const req = (id) => {
            if (cache[id])
                return cache[id].exports;
            const m = (cache[id] = { exports: {}, id });
            if (!modules[id])
                return (m.exports = new Proxy(function () { }, { get: () => () => { } }));
            modules[id].call(m.exports, m, m.exports, req);
            const ex = m.exports;
            if (ex && ex.useState && ex.useEffect && ex.createElement)
                m.exports = R;
            else if (ex && ex.jsx && ex.jsxs)
                m.exports = JSX;
            else if (ex && ex.useRouter && ex.useSearchParams)
                m.exports = nav;
            return m.exports;
        };
        Object.assign(req, {
            d: (e, t) => {
                for (const k in t)
                    if (Object.hasOwn(t, k) && !Object.hasOwn(e, k))
                        Object.defineProperty(e, k, { enumerable: true, get: t[k] });
            },
            o: (e, t) => Object.hasOwn(e, t),
            r: (e) => Object.defineProperty(e, "__esModule", { value: true }),
            n: (e) => {
                const t = e && e.__esModule ? () => e.default : () => e;
                req.d(t, { a: t });
                return t;
            },
            t(o, n) {
                return 1 & n ? this(o) : o;
            },
            g: ctx,
            p: "/_next/",
            e: () => Promise.resolve(),
            nmd: (m) => m,
            hmd: (m) => m,
        });
        const Comp = req(modId).default;
        if (typeof Comp !== "function")
            throw new Error("player component not found");
        let video = null;
        const render = () => {
            renders++;
            st.i = 0;
            try {
                Comp(props);
            }
            catch { }
            const effs = st.effects;
            st.effects = [];
            for (const f of effs)
                f();
            if (video && !closed) {
                for (const ref of videoRefs)
                    if (ref.current == null)
                        ref.current = video;
                for (const i of videoHookIndexes)
                    if (st.hooks[i] && st.hooks[i].current == null)
                        st.hooks[i].current = video;
            }
        };
        const wait = (ms, pred) => new Promise((resolve) => {
            const t0 = Date.now();
            const tick = () => {
                if (signal.aborted || closed || pred() || Date.now() - t0 > ms)
                    return resolve();
                setTimeout(tick, STREAM_POLL);
            };
            tick();
        });
        const deadline = Date.now() + TOTAL_TIMEOUT;
        let videoHookIndexes = [];
        render();
        const serversHook = () => st.hooks.find((h) => h?.state && Array.isArray(h.v) && h.v.length && h.v.every((s) => s && s.name && s.data));
        await wait(TOTAL_TIMEOUT, () => serversHook());
        const sh = serversHook();
        if (!sh)
            return;
        video = win.document.createElement("video");
        win.document.body.appendChild(video);
        if (videoRefs.size) {
            for (const ref of videoRefs)
                ref.current ??= video;
        }
        else {
            videoHookIndexes = refHooksForVideo(st.hooks);
            for (const i of videoHookIndexes)
                if (st.hooks[i])
                    st.hooks[i].current = video;
        }
        const seen = new Set();
        const delivered = new Set();
        const streamValue = (h) => {
            const v = h && (h.state ? h.v : h.current);
            return v && typeof v === "object" && typeof v.url === "string" && /^https?:/.test(v.url) ? v : null;
        };
        const fresh = () => {
            const out = [];
            for (const h of st.hooks) {
                const v = streamValue(h);
                if (!v || seen.has(v))
                    continue;
                seen.add(v);
                out.push(v);
            }
            return out;
        };
        const hasFreshStream = () => st.hooks.some((h) => {
            const v = streamValue(h);
            return v && !seen.has(v);
        });
        const emit = (source) => {
            if (source.mp4 || /\.mp4(?:[?#]|$)/i.test(source.url) || delivered.has(source.url))
                return false;
            delivered.add(source.url);
            return true;
        };
        let yielded = 0;
        for (const { name } of [...sh.v]) {
            if (signal.aborted || Date.now() > deadline || relayCalls + RELAY_PER_SERVER > RELAY_SOFT_LIMIT)
                break;
            sh.set((list) => list.map((s) => { s.selected = s.name === name; return s; }));
            await wait(Math.min(NEXT_SERVER_WAIT, deadline - Date.now()), () => hasFreshStream());
            for (const source of fresh()) {
                if (emit(source)) {
                    yielded++;
                    yield { url: source.url, noReferrer: source.noReferrer === true };
                }
            }
            if (yielded && relayCalls + RELAY_PER_SERVER > RELAY_SOFT_LIMIT)
                break;
        }
        for (const source of fresh()) {
            if (emit(source))
                yield { url: source.url, noReferrer: source.noReferrer === true };
        }
    }
    finally {
        teardown();
    }
}
