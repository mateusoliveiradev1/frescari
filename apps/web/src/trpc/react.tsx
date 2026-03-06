import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@frescari/api';

// @ts-expect-error - Bypassing strict cross-package generic constraints for unbuilt local workspace dependency
export const trpc = createTRPCReact<AppRouter>();
