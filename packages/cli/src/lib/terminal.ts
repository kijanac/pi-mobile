import { connect } from "node:net";
import * as QRCode from "qrcode";

export async function portIsOpen(host: string, port: number): Promise<boolean> {
  return await new Promise<boolean>((resolveOpen) => {
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolveOpen(false);
    }, 500).unref();

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

export async function terminalQr(text: string): Promise<string | undefined> {
  try {
    return await QRCode.toString(text, { type: "terminal", small: true });
  } catch (error) {
    console.warn(`\nWARNING: failed to render terminal QR: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}
