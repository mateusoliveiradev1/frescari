type MockDb = Record<string, any>;

function decorateMockDb(target: MockDb, fallback: MockDb) {
    const originalTransaction =
        typeof target.transaction === 'function'
            ? target.transaction.bind(target)
            : null;

    if (typeof target.execute !== 'function') {
        target.execute = async () => [];
    }

    target.transaction = async (callback: (tx: MockDb) => Promise<unknown>) => {
        if (!originalTransaction) {
            return callback(target);
        }

        return originalTransaction(async (tx: MockDb) => {
            const mergedTxSource =
                tx && typeof tx === 'object'
                    ? { ...fallback, ...tx }
                    : { ...fallback };

            const mergedTx = decorateMockDb(mergedTxSource, fallback);
            return callback(mergedTx);
        });
    };

    return target;
}

export function withRlsMockDb<T extends MockDb>(db: T): T {
    return decorateMockDb(db, db) as T;
}
