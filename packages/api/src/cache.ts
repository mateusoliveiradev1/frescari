import { revalidatePath } from 'next/cache';

export function safeRevalidatePath(
    path: string,
    type?: 'layout' | 'page',
) {
    try {
        revalidatePath(path, type);
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes('static generation store missing')
        ) {
            return;
        }

        throw error;
    }
}
