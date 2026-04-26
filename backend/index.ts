const isRender = process.env.RENDER === "true";
const isRenderWeb = process.env.RENDER_SERVICE_TYPE === "web";
const isRenderBuild = isRender && isRenderWeb && !process.env.RENDER_WEB_CONCURRENCY;
const isRenderRuntime = isRender && isRenderWeb && !!process.env.RENDER_WEB_CONCURRENCY;

if (isRenderBuild) {
  console.log("Render build detected without PORT; skipping server startup.");
  process.exit(0);
}

if (isRenderRuntime) {
  await import(new URL("./dist/server.js", import.meta.url).href);
} else {
  await import(new URL("./server.ts", import.meta.url).href);
}
