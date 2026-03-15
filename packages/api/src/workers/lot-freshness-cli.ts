import {
    closeDbPools,
} from '@frescari/db';
import {
    LOT_FRESHNESS_RUN_ONCE_TIMEOUT_MS,
    runLotFreshnessOnce,
    startLotFreshnessWorker,
} from './lot-freshness';

async function mainWorker() {
    const runtime = await startLotFreshnessWorker();

    console.info('[lot-freshness-worker] online and scheduled every 6 hours.');

    const shutdown = async (signal: string) => {
        console.info(`[lot-freshness-worker] shutting down after ${signal}.`);
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
    console.info('[lot-freshness-worker] starting one-shot execution.');

    try {
        const { jobId, result } = await runLotFreshnessOnce({
            timeoutMs: LOT_FRESHNESS_RUN_ONCE_TIMEOUT_MS,
        });

        console.info(
            `[lot-freshness-worker] one-shot job ${jobId ?? 'unknown'} completed: ${JSON.stringify(result)}`,
        );
    }
    finally {
        await closeDbPools();
    }
}

export async function runLotFreshnessCli(argv = process.argv.slice(2)) {
    if (argv.includes('--run-once')) {
        await mainRunOnce();
        return;
    }

    await mainWorker();
}

runLotFreshnessCli().catch((error) => {
    console.error('[lot-freshness-worker] failed to start:', error);
    process.exit(1);
});
