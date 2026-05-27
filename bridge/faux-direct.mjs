import {
  registerFauxProvider,
  fauxAssistantMessage,
  fauxText,
} from "@earendil-works/pi-ai";

const reg = registerFauxProvider({
  provider: "shake",
  api: "faux",
  models: [{ id: "shake-1", name: "Shake", input: ["text"], contextWindow: 100_000, maxTokens: 4096 }],
  tokensPerSecond: 0, // no delay
});
reg.setResponses([fauxAssistantMessage(fauxText("Hello from faux. Streaming works."))]);

const { streamSimple } = await import("@earendil-works/pi-ai");
const model = reg.getModel();
console.log("model:", { id: model.id, api: model.api, provider: model.provider });

const stream = streamSimple(model, {
  messages: [{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: Date.now() }],
});

const types = [];
for await (const ev of stream) {
  types.push(ev.type);
  if (ev.type === "text_delta") console.log("  delta:", JSON.stringify(ev.delta));
}
console.log("\nevent types in order:", types);
