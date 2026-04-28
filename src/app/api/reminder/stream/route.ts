import { NextRequest } from 'next/server';
import { getClassReminder } from '@/lib/reminder-store';

export const runtime = 'nodejs';

function encodeSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest) {
  const classIdParam = new URL(request.url).searchParams.get('classId');
  const classId = Number(classIdParam);

  if (!Number.isFinite(classId) || classId <= 0) {
    return new Response('Invalid classId', { status: 400 });
  }

  let interval: ReturnType<typeof setInterval> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;
  let lastReminderId: string | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const push = (event: string, payload: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeSse(event, payload)));
      };

      push('ready', { classId });

      interval = setInterval(() => {
        const reminder = getClassReminder(classId);
        if (!reminder?.id || !reminder.message) return;
        if (reminder.id === lastReminderId) return;
        lastReminderId = reminder.id;
        push('reminder', reminder);
      }, 1000);

      // Keep intermediaries and browsers from closing idle SSE connections.
      heartbeat = setInterval(() => {
        push('ping', { ts: Date.now() });
      }, 15000);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
