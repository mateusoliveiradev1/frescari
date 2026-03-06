import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
export const connectionString = process.env.DATABASE_URL || "postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb";

// Neon requires HTTP/S or legitimate neon postgres format. Provide a mock proxy pattern for static builds.
export const client = process.env.NODE_ENV === "production" && !process.env.DATABASE_URL
    ? neon("postgres://mock:mock@ep-mock-123456.us-east-2.aws.neon.tech/neondb")
    : neon(connectionString);

export const db = drizzle(client, { schema });

export * from './schema';
