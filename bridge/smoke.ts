// Smoke test: boot bridge, create session, drive a WS conversation.
const BASE = "http://localhost:7777";

console.log("→ POST /sessions");
const meta = await fetch(`${BASE}/sessions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ cwd: "/tmp/demo", title: "ws smoke" }),
}).then((r) => r.json());
console.log("  ←", meta);

const ws = new WebSocket(`ws://localhost:7777/ws?session=${meta.id}&cursor=0`);

let permId: string | null = null;
let lastSeq = 0;

ws.onopen = () => {
  console.log("→ ws open; sending 'hi pi'");
  ws.send(JSON.stringify({ t: "send", text: "switch HS256 to RS256" }));
};

ws.onerror = (e) => console.log("  ws error:", (e as any).message ?? e);
ws.onclose = (e) =>
  console.log(`  ws close code=${e.code} reason=${e.reason || "(none)"}`);

ws.onmessage = (ev) => {
  const e = JSON.parse(ev.data as string);
  lastSeq = e.seq ?? lastSeq;
  if (e.t === "assistant_delta") {
    process.stdout.write(e.text);
  } else if (e.t === "assistant_end") {
    process.stdout.write("\n");
  } else if (e.t === "permission") {
    permId = e.entry.id;
    console.log(`  ← permission gate (id=${permId}, seq=${e.seq})`);
    console.log("→ replying allow_session");
    ws.send(
      JSON.stringify({ t: "permission_reply", id: permId, choice: "allow_session" }),
    );
  } else {
    console.log("  ←", e.t, "seq=" + e.seq);
  }
};

await new Promise<void>((r) => setTimeout(r, 4500));
ws.close();
console.log(`\n[final cursor seq=${lastSeq}]`);
