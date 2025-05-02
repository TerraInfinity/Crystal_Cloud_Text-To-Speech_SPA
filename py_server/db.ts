/**
 * Database Connection Module
 * 
 * This module sets up a connection to the Neon serverless Postgres database
 * using the Neon serverless driver. It configures and exports the database
 * connection pool and Drizzle ORM instance for use throughout the application.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema"; 

// Configure Neon to use the WebSocket constructor for serverless environments
neonConfig.webSocketConstructor = ws;

// Validate that DATABASE_URL environment variable is properly set
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create a connection pool to the Neon Postgres database
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Initialize and export the Drizzle ORM instance with the database schema
export const db = drizzle({ client: pool, schema });
