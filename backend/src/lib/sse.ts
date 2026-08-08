import type { Response } from "express";

export interface SSEChannel {
  send: (event: string, data: unknown) => void;
  close: () => void;
}

export function openSSEChannel(res: Response): SSEChannel {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  return {
    send(event: string, data: unknown) {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    },
    close() {
      res.end();
    },
  };
}
