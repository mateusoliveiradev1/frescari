declare module 'next/cache' {
    export function revalidatePath(path: string, type?: 'layout' | 'page'): void;
}
