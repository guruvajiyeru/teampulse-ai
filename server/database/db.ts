import mongoose from "mongoose";

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.warn(
      "⚠️  MONGO_URI is not set in .env — MongoDB connection skipped. " +
      "The server will use the local JSON file store (db-storage/db.json) as fallback."
    );
    return;
  }

  try {
    await mongoose.connect(uri, {
      dbName: "teampulseai",
    });
    isConnected = true;
    console.log("✅ MongoDB connected via Mongoose —", uri.split("@").pop());
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error);
    console.warn("⚠️  Falling back to local JSON file store.");
  }
}

export function getConnectionState() {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  };
}

export default connectDB;
