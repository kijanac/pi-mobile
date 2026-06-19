import { connect } from "node:net";

export async function portIsOpen(host: string, port: number, timeoutMs = 500): Promise<boolean> {
  return await new Promise<boolean>((resolveOpen) => {
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolveOpen(false);
    }, timeoutMs).unref();

    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      resolveOpen(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolveOpen(false);
    });
  });
}

export async function healthcheck(url: string, timeoutMs = 5_000): Promise<boolean> {
  try {
    const response = await fetch(`${url.replace(/\/+$/, "")}/healthz`, { signal: AbortSignal.timeout(timeoutMs) });
    return response.ok;
  } catch {
    return false;
  }
}
