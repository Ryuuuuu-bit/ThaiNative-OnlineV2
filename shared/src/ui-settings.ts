import {z} from 'zod';
export const UISettingsSchema=z.object({scale:z.union([z.literal(90),z.literal(100),z.literal(110),z.literal(120)]),windows:z.object({bag:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).optional(),stats:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).optional(),skills:z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).optional()}).strict(),keys:z.object({returnCity:z.string().regex(/^(Key[A-Z]|Digit[0-9])$/),pickupAll:z.string().regex(/^(Key[A-Z]|Digit[0-9])$/)}).strict()}).strict();
export type UISettings=z.infer<typeof UISettingsSchema>;
export const DEFAULT_UI:UISettings={scale:100,windows:{},keys:{returnCity:'KeyH',pickupAll:'KeyZ'}};
