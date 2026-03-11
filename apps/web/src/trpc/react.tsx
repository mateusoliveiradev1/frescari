"use client";

import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@frescari/api';

export const trpc = createTRPCReact<AppRouter>();
