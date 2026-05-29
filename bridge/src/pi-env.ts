import { PiClientLive } from "./pi.ts";
import { PiClientMock } from "./pi-mock.ts";

export const PiClientFromEnv =
  process.env.PI_USE_MOCK === "1" ? PiClientMock : PiClientLive;
