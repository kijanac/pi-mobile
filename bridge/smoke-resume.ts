// Resume from cursor — proves SQLite replay path
const BASE = "http://localhost:7777";
const list = await fetch(`${BASE}/sessions`).then((r) => r.json());
if (!list[0]) { console.error("no session"); process.exit(1); }
const id = list[0].id;
const CURSOR = 10;
const ws = new WebSocket(`ws://localhost:7777/ws?session=${id}&cursor=${CURSOR}`);
const seqs: number[] = [];
const byType: Record<string, number> = {};
ws.onmessage = (ev) => {
  const e = JSON.parse(ev.data as string);
  seqs.push(e.seq);
  byType[e.t] = (byType[e.t] ?? 0) + 1;
};
await new Promise((r) => setTimeout(r, 1500));
ws.close();
await new Promise((r) => setTimeout(r, 200));
console.log(`replay from cursor=${CURSOR}: ${seqs.length} events`);
console.log(`  seq range: ${seqs[0]} → ${seqs[seqs.length - 1]}`);
console.log(`  by type:`, byType);
