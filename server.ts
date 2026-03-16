import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, orderBy, deleteDoc } from "firebase/firestore";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase on the server
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());
  app.use(cookieParser());

  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // --- SIMPLE AUTH PROXY (For No-VPN Testing) ---
  app.post("/api/proxy/login", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    try {
      // In a real app, you'd verify a password. For this test, we'll use email as ID.
      // We'll look for a user document or just use the email to hash a UID.
      const uid = Buffer.from(email).toString("base64").replace(/=/g, "");
      
      // Set a simple session cookie
      res.cookie("user_uid", uid, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
      res.cookie("user_email", email, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
      
      res.json({ uid, email });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/proxy/user", (req, res) => {
    const uid = req.cookies.user_uid;
    const email = req.cookies.user_email;
    if (!uid) return res.json({ user: null });
    res.json({ user: { uid, email } });
  });

  app.post("/api/proxy/logout", (req, res) => {
    res.clearCookie("user_uid");
    res.clearCookie("user_email");
    res.json({ success: true });
  });

  // --- DATA PROXY (Firestore) ---
  app.get("/api/proxy/words", async (req, res) => {
    const uid = req.cookies.user_uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    try {
      const q = query(collection(db, `users/${uid}/words`), orderBy("nextReviewDate", "asc"));
      const snapshot = await getDocs(q);
      const words = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(words);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/proxy/words", async (req, res) => {
    const uid = req.cookies.user_uid;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    try {
      const wordData = {
        ...req.body,
        userId: uid,
        createdAt: serverTimestamp(),
        nextReviewDate: Timestamp.fromDate(new Date(req.body.nextReviewDate || Date.now())),
      };
      const docRef = await addDoc(collection(db, `users/${uid}/words`), wordData);
      res.json({ id: docRef.id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/proxy/words/:id", async (req, res) => {
    const uid = req.cookies.user_uid;
    const { id } = req.params;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    try {
      const data = { ...req.body };
      if (data.nextReviewDate) {
        data.nextReviewDate = Timestamp.fromDate(new Date(data.nextReviewDate));
      }
      if (data.lastReviewedAt === "serverTimestamp") {
        data.lastReviewedAt = serverTimestamp();
      }
      
      await updateDoc(doc(db, `users/${uid}/words`, id), data);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/proxy/words/:id", async (req, res) => {
    const uid = req.cookies.user_uid;
    const { id } = req.params;
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    try {
      await deleteDoc(doc(db, `users/${uid}/words`, id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- GEMINI PROXY ---
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured on the server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: model || "gemini-2.0-flash",
        contents,
        config,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
