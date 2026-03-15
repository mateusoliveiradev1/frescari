import { createUploadthing, type FileRouter, UploadThingError } from "uploadthing/server";

import { auth } from "@/lib/auth";

const f = createUploadthing();

type UploadUser = {
    id?: string | null;
    role?: string | null;
    tenantId?: string | null;
} | null | undefined;

type UploadActor = {
    userId: string;
    tenantId: string;
    role: "producer";
};

export function assertProducerUploadActor(user: UploadUser): UploadActor {
    if (!user?.id) {
        throw new UploadThingError("Unauthorized");
    }

    if (user.role !== "producer") {
        throw new UploadThingError("Forbidden");
    }

    if (!user.tenantId) {
        throw new UploadThingError("User must belong to a tenant");
    }

    return {
        userId: user.id,
        tenantId: user.tenantId,
        role: "producer",
    };
}

export const ourFileRouter = {
    lotImage: f({
        image: {
            maxFileSize: "8MB",
            maxFileCount: 1,
        },
    })
        .middleware(async ({ req }) => {
            const session = await auth.api.getSession({
                headers: req.headers,
            });

            return assertProducerUploadActor(session?.user);
        })
        .onUploadComplete(async ({ file, metadata }) => {
            console.log("[UPLOADTHING] Upload concluido:", {
                url: file.ufsUrl,
                tenantId: metadata.tenantId,
                userId: metadata.userId,
            });

            return {
                url: file.ufsUrl,
                tenantId: metadata.tenantId,
            };
        }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
