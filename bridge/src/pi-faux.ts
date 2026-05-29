import { AuthStorage } from "@earendil-works/pi-coding-agent";
import {
  fauxAssistantMessage,
  fauxText,
  registerFauxProvider,
} from "@earendil-works/pi-ai";

let fauxRegistration: ReturnType<typeof registerFauxProvider> | null = null;

const registerFaux = () => {
  if (!fauxRegistration) {
    fauxRegistration = registerFauxProvider({
      provider: "shakedown",
      api: "faux",
      models: [
        {
          id: "shakedown-1",
          name: "Faux Shakedown",
          input: ["text"],
          contextWindow: 100_000,
          maxTokens: 4096,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        },
      ],
      tokensPerSecond: 40,
      tokenSize: { min: 3, max: 7 },
    });
  }

  if (process.env.PI_FAUX_ERROR === "1") {
    fauxRegistration.setResponses([
      fauxAssistantMessage(fauxText(""), {
        stopReason: "error",
        errorMessage: "Connection error. (faux: simulated provider failure)",
      }),
    ]);
  } else {
    fauxRegistration.setResponses([
      fauxAssistantMessage(
        fauxText(
          "Acknowledged. Running a quick shakedown of the live pi event pipeline. " +
            "If you can read this in the chat, **streaming markdown** works.",
        ),
        { stopReason: "stop" },
      ),
    ]);
  }

  return fauxRegistration.getModel();
};

export const setupFauxIfEnabled = (
  authStorage: ReturnType<typeof AuthStorage.create>,
): ReturnType<typeof registerFaux> | null => {
  if (process.env.PI_FAUX !== "1") return null;
  const fauxModel = registerFaux();
  authStorage.setRuntimeApiKey("shakedown", "faux");
  return fauxModel;
};
