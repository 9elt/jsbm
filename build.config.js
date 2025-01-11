const srcdir = "./src";

export default {
    minify: false,
    entrypoint: srcdir + "/index.ts",
    outdir: ".",
    external: ["typescript"],
};
