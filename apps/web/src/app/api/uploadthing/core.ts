import { createUploadthing, type FileRouter } from "uploadthing/server";

const f = createUploadthing();

export const ourFileRouter = {
    lotImage: f({
        image: {
            maxFileSize: "4MB",
            maxFileCount: 1,
        },
    }).onUploadComplete(async ({ file }) => {
        console.log("[UPLOADTHING] Upload concluído:", file.ufsUrl);
        return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
