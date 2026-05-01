import mongoose from "mongoose";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const uri = requireEnv("MONGODB_URI");
const dbName = process.env.MONGODB_DB_NAME?.trim() || "poorplexity";

const globalForMongoose = globalThis as typeof globalThis & {
  __poorplexityMongoosePromise?: Promise<typeof mongoose>;
};

export async function getMongoose() {
  if (!globalForMongoose.__poorplexityMongoosePromise) {
    globalForMongoose.__poorplexityMongoosePromise = mongoose.connect(uri, {
      dbName,
      autoIndex: true,
    });
  }

  return globalForMongoose.__poorplexityMongoosePromise;
}

export async function ensureDatabase() {
  await getMongoose();
}
