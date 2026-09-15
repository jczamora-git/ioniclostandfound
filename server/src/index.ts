import 'dotenv/config';
import dotenv from 'dotenv';
import path from 'path';
import app from './app.js';

// Support loading from both cwd and server/.env locations
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });

const PORT = Number(process.env.PORT || 3000);

if (!process.env.UPLOADTHING_TOKEN) {
  console.error('[UploadThing] UPLOADTHING_TOKEN is missing');
}
console.log('[UploadThing]', {
  configured: Boolean(process.env.UPLOADTHING_TOKEN)
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=========================================`);
  console.log(`🚀 Lost & Found Local Development Server`);
  console.log(`📡 Listening on: http://0.0.0.0:${PORT} (LAN reachable)`);
  console.log(`=========================================`);
});
