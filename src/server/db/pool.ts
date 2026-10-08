import mysql, { type Pool } from 'mysql2/promise';
import type { Env } from '../env';

/** Creates the MySQL connection pool used by the whole application. */
export function createPool(env: Env['db']): Pool {
  return mysql.createPool({
    host: env.host,
    port: env.port,
    database: env.name,
    user: env.user,
    password: env.password,
    connectionLimit: env.poolSize,
    waitForConnections: true,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
    timezone: 'Z',
    dateStrings: false,
    supportBigNumbers: true,
    decimalNumbers: true,
    namedPlaceholders: false,
    multipleStatements: false,
  });
}
