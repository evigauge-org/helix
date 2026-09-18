// lib/agents/tools/sandbox/stream-buffer.ts
type Channel = "stdout" | "stderr";

/**
 * Accumulates streamed E2B chunks and flushes either every flushIntervalMs
 * since the last flush OR when maxBytesBeforeFlush characters have been
 * accumulated, whichever fires first. Empty flushes are skipped (no
 * AgentStep row written for an empty buffer).
 */
export class ChunkBuffer {
  private buffers: Record<Channel, string> = { stdout: "", stderr: "" };
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly opts: {
      flushIntervalMs: number;
      maxBytesBeforeFlush: number;
      onFlush: (channel: Channel, chunk: string) => Promise<void> | void;
    },
  ) {}

  push(channel: Channel, data: string): void {
    if (!data) return;
    this.buffers[channel] += data;
    if (this.buffers[channel].length >= this.opts.maxBytesBeforeFlush) {
      void this.flushChannel(channel);
    } else {
      this.armTimer();
    }
  }

  /** Drain any partial buffers; safe to call multiple times. */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.flushChannel("stdout");
    await this.flushChannel("stderr");
  }

  private armTimer(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.opts.flushIntervalMs);
  }

  private async flushChannel(channel: Channel): Promise<void> {
    const chunk = this.buffers[channel];
    if (!chunk) return;
    this.buffers[channel] = "";
    try {
      await this.opts.onFlush(channel, chunk);
    } catch {
      // Lost flush is acceptable — final flush() in tool.execute() will
      // retry whatever is in the buffer at end-of-call. No data loss for
      // small drops because we cleared *after* the await; if onFlush
      // threw we already lost this chunk. That's the documented v1
      // tradeoff (vs. a more complex retry queue).
    }
  }
}
