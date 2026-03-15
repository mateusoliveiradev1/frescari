import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
export const connectionString =
    process.env.DATABASE_URL ||
    "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb";
export const adminConnectionString =
    process.env.DATABASE_ADMIN_URL ||
    process.env.DATABASE_URL ||
    connectionString;

// Neon requires legitimate postgres format. Provide a mock proxy pattern for static builds.
const connectionUrl = process.env.NODE_ENV === "production" && !process.env.DATABASE_URL
    ? "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb"
    : connectionString;
const adminConnectionUrl =
    process.env.NODE_ENV === "production" &&
    !process.env.DATABASE_ADMIN_URL &&
    !process.env.DATABASE_URL
        ? "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb"
        : adminConnectionString;

export const client = new Pool({ connectionString: connectionUrl });
export const authClient = new Pool({ connectionString: adminConnectionUrl });

export const db = drizzle(client, { schema });
export const authDb = drizzle(authClient, { schema });
export type AppDb = Omit<typeof db, '$client'>;

export * from './schema';
export * from './connection-string';
export * from './rls-scope';
export * from './product-lot-scope';
