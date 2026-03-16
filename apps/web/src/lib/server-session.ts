import { cache } from "react";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";

// Deduplicate Better Auth reads within the same server request.
export const getRequestAuthSession = cache(async () => {
    return auth.api.getSession({
        headers: await headers(),
    });
});
