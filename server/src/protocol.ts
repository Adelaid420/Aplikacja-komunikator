import { z } from 'zod';

export const connectionParamsSchema = z.object({
  pairId: z.string().min(1, 'pairId is required'),
  userId: z.string().min(1, 'userId is required')
});

export const inboundMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    content: z.string().min(1, 'content must not be empty'),
    id: z.string().optional(),
    timestamp: z.number().optional()
  }),
  z.object({
    type: z.literal('alarm'),
    level: z.enum(['default', 'urgent']).default('default'),
    note: z.string().optional()
  }),
  z.object({
    type: z.literal('status'),
    presence: z.enum(['available', 'busy', 'away']),
    note: z.string().optional()
  })
]);

export type ConnectionParams = z.infer<typeof connectionParamsSchema>;
export type InboundMessage = z.infer<typeof inboundMessageSchema>;

export type OutboundMessage =
  | { type: 'text'; from: string; content: string; id: string; timestamp: number }
  | { type: 'alarm'; from: string; level: 'default' | 'urgent'; note?: string; timestamp: number }
  | { type: 'status'; from: string; presence: 'available' | 'busy' | 'away'; note?: string; timestamp: number }
  | { type: 'system'; event: 'connected'; pairId: string; partnerOnline: boolean }
  | { type: 'error'; message: string };

export function safeParseJson(payload: string): unknown | undefined {
  try {
    return JSON.parse(payload);
  } catch (error) {
    return undefined;
  }
}

export function createMessageId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
