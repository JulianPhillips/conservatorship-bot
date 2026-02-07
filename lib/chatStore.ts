import fs from "fs";
import path from "path";

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type ChatSession = {
  id: string;
  createdAt: string;
  updatedAt: string;
  turns: ChatTurn[];
};

const CHAT_FILE = path.join(process.cwd(), "data", "chat_sessions.jsonl");
const CHAT_SESSIONS: Map<string, ChatSession> = new Map();

function ensureChatDir() {
  const dir = path.dirname(CHAT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function saveChatSession(id: string, turns: ChatTurn[]) {
  const now = new Date().toISOString();
  const existing = CHAT_SESSIONS.get(id);
  const session: ChatSession = existing
    ? { ...existing, updatedAt: now, turns }
    : { id, createdAt: now, updatedAt: now, turns };

  CHAT_SESSIONS.set(id, session);
  try {
    ensureChatDir();
    fs.appendFileSync(CHAT_FILE, JSON.stringify(session) + "\n");
  } catch (err) {
    console.error("Failed to write chat session", err);
  }
}

export function getChatSession(id: string): ChatSession | undefined {
  return CHAT_SESSIONS.get(id);
}
