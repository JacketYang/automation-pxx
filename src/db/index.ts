import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error("DATABASE_URL is required");
const g=globalThis as typeof globalThis & {__pxxPostgresPool?:Pool};
export const pool=g.__pxxPostgresPool??new Pool({connectionString:databaseUrl,max:1,idleTimeoutMillis:10000,connectionTimeoutMillis:10000,allowExitOnIdle:true});
if(process.env.NODE_ENV!=="production")g.__pxxPostgresPool=pool;
export const db=drizzle(pool);
