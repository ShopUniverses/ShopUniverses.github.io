// ========================================================
// NETLIFY FUNCTION — Adaptador Serverless para Express
// ========================================================
import serverless from 'serverless-http';
import { app } from '../../src/server.js';

export const handler = serverless(app);
