import { z } from 'zod';
export const AudioSettingsSchema = z.object({
  sfx: z.number().finite().min(0).max(1),
  music: z.number().finite().min(0).max(1),
  ambience: z.number().finite().min(0).max(1),
  muted: z.boolean(),
}).strict();
export type AudioSettings = z.infer<typeof AudioSettingsSchema>;
export const DEFAULT_AUDIO: AudioSettings = { sfx: .8, music: .6, ambience: .5, muted: false };
