import config from "./build.config";

const build = await Bun.build({
    target: "node",
    entrypoints: [config.entrypoint],
    outdir: config.outdir,
    minify: config.minify,
    external: config.external,
});

if (!build.success) {
    console.log(build);
    throw new Error("Build failed");
}
