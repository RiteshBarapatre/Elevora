import { initializeApp, cert, getApps } from "firebase-admin/app";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = path.resolve(__dirname, "../serviceAccountKey.json");

const projectId = process.env.FIREBASE_PROJECT_ID || "fresherai-c5a28";

let app;

if (getApps().length === 0) {
  let serviceAccount = null;

  if (fs.existsSync(serviceAccountPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
      // Check if serviceAccount has private key and matches current project
      if (
        data &&
        data.project_id === projectId &&
        data.private_key &&
        data.client_email &&
        !data.private_key.includes("YOUR_PRIVATE_KEY")
      ) {
        serviceAccount = data;
      }
    } catch (e) {
      console.warn("Could not parse serviceAccountKey.json:", e.message);
    }
  }

  if (serviceAccount) {
    try {
      app = initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch (e) {
      console.warn("Failed to initialize Firebase Admin with serviceAccountKey:", e.message);
      app = initializeApp({ projectId });
    }
  } else {
    app = initializeApp({ projectId });
  }
} else {
  app = getApps()[0];
}

export { app };