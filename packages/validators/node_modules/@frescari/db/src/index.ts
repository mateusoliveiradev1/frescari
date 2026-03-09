import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';
export const connectionString = process.env.DATABASE_URL || "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb";

// Neon requires legitimate postgres format. Provide a mock proxy pattern for static builds.
const connectionUrl = process.env.NODE_ENV === "production" && !process.env.DATABASE_URL
    ? "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb"
    : connectionString;

export const client = new Pool({ connectionString: connectionUrl });

export const db = drizzle(client, { schema });

export * from './schema';
