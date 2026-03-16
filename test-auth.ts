import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import fs from "fs";
import path from "path";

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf-8"));
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

async function test() {
  try {
    await signInAnonymously(auth);
    console.log("SUCCESS_ANON");
  } catch (error: any) {
    console.log("ERROR_ANON", error.code);
  }
  process.exit(0);
}

test();
