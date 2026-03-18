import { closeDbPools } from '@frescari/db';
import {
    NOTIFICATION_RUN_ONCE_TIMEOUT_MS,
    runNotificationScanOnce,
    startNotificationWorker,
} from './notification-worker';

async function mainWorker() {
    const runtime = await startNotificationWorker();

    console.info('[notification-worker] online (lot-events + delivery-delay scan every 5 minutes).');

    const shutdown = async (signal: string) => {
        console.info(`[notification-worker] shutting down after ${signal}.`);
        await Promise.allSettled([
            runtime.close(),
            closeDbPools(),
        ]);
        process.exit(0);
    };

    process.once('SIGINT', () => {
        void shutdown('SIGINT');
    });

    process.once('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
}

async function mainRunOnce() {
    console.info('[notification-worker] starting one-shot delivery delay scan.');

    try {
        const { jobId, result } = await runNotificationScanOnce({
            timeoutMs: NOTIFICATION_RUN_ONCE_TIMEOUT_MS,
        });

        console.info(
            `[notification-worker] one-shot job ${jobId ?? 'unknown'} completed: ${JSON.stringify(result)}`,
        );
    }
    finally {
        await closeDbPools();
    }
}

export async function runNotificationWorkerCli(argv = process.argv.slice(2)) {
    if (argv.includes('--run-once')) {
        await mainRunOnce();
        return;
    }

    await mainWorker();
}

runNotificationWorkerCli().catch((error) => {
    console.error('[notification-worker] failed to start:', error);
    process.exit(1);
});
