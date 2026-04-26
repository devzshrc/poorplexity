import { auth } from "./src/auth";

const ctx = await auth.$context;

await ctx.runMigrations();

console.log("Better Auth migrations completed.");
