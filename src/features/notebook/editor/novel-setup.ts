// Novel works with a global __VERSION__ variable which is usually defined by the build tool.
// Since Next.js config treats this as a reserved word in some environments, we polyfill it here.

if (typeof globalThis !== "undefined") {
    (globalThis as any).__VERSION__ = "novel-1.0.2";
}

export { };
