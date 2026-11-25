import { describe, expect, test } from "bun:test";
import vm from "node:vm";
import { patchPlayerChunk, playerVariants, refHooksForVideo } from "./extract.mjs";

const VARIANT_SRC = `t.d(r,{default:()=>s});t(36552);let o={"-r-_7oyryyWpHqm5C5owmy":l()(()=>Promise.all([t.e(820),t.e(268),t.e(687),t.e(585),t.e(286),t.e(396)]).then(t.bind(t,30396)),{loadableGenerated:{webpack:()=>[require.resolveWeak("../components/Player.js?artifact=-r-_7oyryyWpHqm5C5owmy")]}}),"0jR656CVrDq3cjar5bO30s":l()(()=>Promise.all([t.e(820),t.e(268),t.e(687),t.e(585),t.e(286),t.e(706)]).then(t.bind(t,59706)),{loadableGenerated:{webpack:()=>[require.resolveWeak("../components/Player.js?artifact=0jR656CVrDq3cjar5bO30s")]}}),plainKey:l()(()=>Promise.all([t.e(820),t.e(253)]).then(t.bind(t,5252))),...};`;

describe("playerVariants", () => {
    test("parses quoted artifact keys with their chunks and module", () => {
        const variants = playerVariants(VARIANT_SRC);
        expect(variants.get("0jR656CVrDq3cjar5bO30s")).toEqual({
            chunks: [820, 268, 687, 585, 286, 706],
            mod: 59706,
        });
    });

    test("parses keys with hyphens and leading dashes", () => {
        const variants = playerVariants(VARIANT_SRC);
        expect(variants.get("-r-_7oyryyWpHqm5C5owmy")).toEqual({
            chunks: [820, 268, 687, 585, 286, 396],
            mod: 30396,
        });
    });

    test("parses unquoted identifier keys", () => {
        const variants = playerVariants(VARIANT_SRC);
        expect(variants.get("plainKey")).toEqual({
            chunks: [820, 253],
            mod: 5252,
        });
    });

    test("returns an empty map when the module has no artifact switch", () => {
        expect(playerVariants('t.d(r,{default:()=>s});let o={};"en":"x"').size).toBe(0);
    });
});

const PLAYER_CHUNK = '"use strict";let p=Object.create(null);function H(e){if(!e||"object"!=typeof e)return;let t=Object.keys(e);for(let r=0;r<t.length;r++)p[t[r]]=e[t[r]]}function w(e){return D[e]}let D=Object.create(null);';

describe("patchPlayerChunk", () => {
    test("wires the state merge callback and keeps the merged object flowing into p", () => {
        const patched = patchPlayerChunk(PLAYER_CHUNK);
        expect(patched).not.toBe(PLAYER_CHUNK);
        expect(patched).toContain("window.__vidcoreMerge");
        const merges = [];
        const sandbox = {
            window: { __vidcoreMerge: (obj) => merges.push(obj) },
        };
        const context = vm.createContext(sandbox);
        vm.runInContext(patched, context, { timeout: 1000 });
        vm.runInContext("H({a: 1})", context, { timeout: 1000 });
        expect(merges).toHaveLength(1);
        expect(vm.runInContext("p.a", context, { timeout: 1000 })).toBe(1);
    });

    test("keeps H usable when no merge callback exists", () => {
        const patched = patchPlayerChunk(PLAYER_CHUNK);
        const context = vm.createContext({});
        vm.runInContext(patched, context, { timeout: 1000 });
        vm.runInContext('H({"b": "c"})', context, { timeout: 1000 });
        expect(vm.runInContext("p.b", context, { timeout: 1000 })).toBe("c");
        expect(() => vm.runInContext("H(null);H(undefined);H(7)", context, { timeout: 1000 })).not.toThrow();
    });

    test("returns the chunk unchanged when the merge anchor is missing", () => {
        const vendor = 'function H(e){if(!e)return 0;return e.x}let q=H({x:2});';
        expect(patchPlayerChunk(vendor)).toBe(vendor);
    });
});

describe("refHooksForVideo", () => {
    test("selects only null-current non-state hooks", () => {
        const hooks = [
            { state: true, v: 3 },
            { current: null },
            { current: "label" },
            { current: null },
        ];
        expect(refHooksForVideo(hooks)).toEqual([1, 3]);
    });

    test("ignores holes, state hooks and initialized refs", () => {
        const hooks = [
            ,
            { state: true, v: [] },
            { current: {} },
            { current: undefined },
        ];
        expect(refHooksForVideo(hooks)).toEqual([]);
    });

    test("returns an empty list for an empty harness", () => {
        expect(refHooksForVideo([])).toEqual([]);
    });
});
