import vm from "node:vm";
import { Window } from "happy-dom";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const SERVER_TIMEOUT = 7000;
const TOTAL_TIMEOUT = 10000;
const scriptCache = new Map();
function getScript(url) {
    if (!scriptCache.has(url)) {
        const p = fetch(url, { headers: { "User-Agent": UA } })
            .then((r) => {
            if (!r.ok)
                throw new Error("chunk " + r.status);
            return r.text();
        })
            .then((code) => new vm.Script(code, { filename: url }));
        p.catch(() => scriptCache.delete(url));
        scriptCache.set(url, p);
        if (scriptCache.size > 60)
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
    const chunks = [...new Set([...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]))].filter((c) => !/\/(webpack|main-app|polyfills)-/.test(c));
    return { props, modId, chunks };
}
function nativeLike(name) {
    return Object.defineProperty(function () { }.bind(null), "name", { value: name });
}
function makeFakeReact(win, onChange) {
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
                st.hooks[i] = {
                    current: init == null ? win.document.body.appendChild(win.document.createElement("video")) : init,
                };
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
        useContext: () => undefined,
        useId: () => ":r0:",
        useSyncExternalStore: (_s, get) => get(),
        useTransition: () => [false, (f) => f()],
        useDeferredValue: (v) => v,
        useImperativeHandle() { },
        useDebugValue() { },
        useInsertionEffect() { },
        createContext: (v) => ({ Provider: () => null, Consumer: () => null, _currentValue: v }),
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
    const base = "https://vidcore.io";
    const isTV = type === "tv";
    const path = isTV ? `/tv/${id}/${season}/${episode}` : `/movie/${id}`;
    const pageResp = await fetch(base + path, { headers: { "User-Agent": UA } });
    if (!pageResp.ok)
        throw new Error("page " + pageResp.status);
    const { props, modId, chunks } = parsePage(await pageResp.text());
    const scripts = await Promise.all(chunks.map((c) => getScript(base + c)));
    const win = new Window({ url: base + path, width: 1280, height: 720 });
    const timers = new Set();
    let closed = false;
    let lastStreamToken = null;
    const prefetched = new Map();
    let getServers = () => [];
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
        MediaSource: undefined,
        ManagedMediaSource: undefined,
        WebKitMediaSource: undefined,
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
            if (new URL(url).origin !== base || /\/wyzie\b/.test(url))
                return Promise.resolve(new Response("", { status: 404 }));
            const h = new Headers(opts.headers);
            h.set("User-Agent", UA);
            h.set("Referer", base + path);
            h.set("Origin", base);
            const reqOpts = { ...opts, headers: h };
            const token = new URL(url).pathname.split("/").pop();
            const done = (r) => {
                lastStreamToken = token;
                return r;
            };
            const servers = getServers();
            if (!prefetched.has(url) && servers.some((server) => server.data === token)) {
                const prefix = url.slice(0, url.length - token.length);
                for (const server of servers.slice(0, 8)) {
                    const target = prefix + server.data;
                    if (!prefetched.has(target)) {
                        const response = fetch(target, { ...reqOpts, signal: AbortSignal.timeout(SERVER_TIMEOUT) });
                        response.catch(() => {});
                        prefetched.set(target, response);
                    }
                }
            }
            const prefetchedResponse = prefetched.get(url);
            if (prefetchedResponse) {
                return prefetchedResponse.then((response) => done(response.clone()))
                    .catch(() => new Response("", { status: 504 }));
            }
            return fetch(url, { ...reqOpts, signal: AbortSignal.timeout(SERVER_TIMEOUT) })
                .then(done)
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
        for (const s of scripts) {
            try {
                s.runInContext(vmCtx, { timeout: 15000 });
            }
            catch { }
        }
        const modules = {};
        for (const entry of ctx.webpackChunk_N_E)
            Object.assign(modules, entry[1]);
        if (!modules[modId])
            throw new Error("player module missing");
        let scheduled = false;
        let renders = 0;
        const { R, st } = makeFakeReact(win, () => {
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
        };
        const wait = (ms, pred) => new Promise((resolve) => {
            const t0 = Date.now();
            const tick = () => {
                if (signal.aborted || closed || pred() || Date.now() - t0 > ms)
                    return resolve();
                setTimeout(tick, 50);
            };
            tick();
        });
        const deadline = Date.now() + TOTAL_TIMEOUT;
        render();
        const serversHook = () => st.hooks.find((h) => h?.state && Array.isArray(h.v) && h.v.length && h.v.every((s) => s && s.name && s.data));
        getServers = () => serversHook()?.v || [];
        await wait(TOTAL_TIMEOUT, () => serversHook());
        const sh = serversHook();
        if (!sh)
            return;
        const seen = new Set();
        const byServer = new Map();
        const harvest = () => {
            for (const h of st.hooks) {
                const v = h && (h.state ? h.v : h.current);
                if (!v || typeof v !== "object" || seen.has(v))
                    continue;
                if (typeof v.url !== "string" || !/^https?:/.test(v.url) || !("tracks" in v || "noReferrer" in v))
                    continue;
                seen.add(v);
                const srv = sh.v.find((s) => s.data === lastStreamToken);
                if (srv && !byServer.has(srv.name))
                    byServer.set(srv.name, { name: srv.name, description: srv.description, obj: v });
            }
        };
        const delivered = new Set();
        const poller = setInterval(harvest, 20);
        try {
            for (const { name } of [...sh.v]) {
                if (signal.aborted || Date.now() > deadline)
                    break;
                harvest();
                if (!byServer.has(name)) {
                    sh.set((list) => list.map((s) => ({ ...s, selected: s.name === name, failed: s.name !== name })));
                    await wait(Math.min(SERVER_TIMEOUT, deadline - Date.now()), () => byServer.has(name)
                        || sh.v.some((server) => server.name === name && server.failed));
                    harvest();
                }
                const source = byServer.get(name)?.obj;
                if (source && !source.mp4 && !/\.mp4(?:[?#]|$)/i.test(source.url) && !delivered.has(source.url)) {
                    delivered.add(source.url);
                    yield { url: source.url, noReferrer: source.noReferrer === true };
                }
                await wait(1500, () => sh.v.every((s) => s.failed || !s.selected));
            }
            harvest();
        }
        finally {
            clearInterval(poller);
        }
    }
    finally {
        teardown();
    }
}
