import { CareerForgeDB } from './db/database.ts';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3456);
const db = new CareerForgeDB();
const app = createApp(db);

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`[CareerForge] Local SQLite DB: ${db.dbPath}`);
  console.log(`[CareerForge] API Server listening on http://127.0.0.1:${port}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
});
