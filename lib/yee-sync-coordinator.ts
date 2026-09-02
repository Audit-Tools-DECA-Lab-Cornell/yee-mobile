import {
    isYeeAccountLeaseCurrent,
    subscribeToYeeAccountChanges,
    type YeeAccountLease,
} from "lib/yee-account-scope";

interface CoordinatedDrain {
    readonly lease: YeeAccountLease;
    readonly promise: Promise<void>;
}

interface DeferredDrain extends CoordinatedDrain {
    readonly timer: ReturnType<typeof setTimeout>;
    settle(): void;
}

export class YeeSyncCoordinator {
    private activeDrain: CoordinatedDrain | null = null;
    private trailingDrain: DeferredDrain | null = null;
    private retryDrain: DeferredDrain | null = null;
    private lastDrainStartedAtMs = 0;

    constructor(private readonly minimumIntervalMs: number) {
        subscribeToYeeAccountChanges(() => {
            this.cancelDeferredDrain();
            this.cancelScheduledRetry();
        });
    }

    request(lease: YeeAccountLease, throttle: boolean, run: () => Promise<void>): Promise<void> {
        if (!isYeeAccountLeaseCurrent(lease)) {
            return Promise.resolve();
        }

        if (this.activeDrain !== null) {
            if (this.activeDrain.lease.generation === lease.generation) {
                return this.activeDrain.promise;
            }
            return this.activeDrain.promise.then(
                () => this.request(lease, throttle, run),
                () => this.request(lease, throttle, run),
            );
        }

        const sinceLastMs = Date.now() - this.lastDrainStartedAtMs;
        if (throttle && sinceLastMs < this.minimumIntervalMs) {
            if (this.trailingDrain?.lease.generation === lease.generation) {
                return this.trailingDrain.promise;
            }
            this.cancelDeferredDrain();

            let settlePromise: () => void = () => undefined;
            const promise = new Promise<void>((resolve) => {
                settlePromise = resolve;
            });
            const timer = setTimeout(() => {
                if (this.trailingDrain?.promise !== promise) {
                    return;
                }
                this.trailingDrain = null;
                void this.request(lease, false, run).finally(settlePromise);
            }, this.minimumIntervalMs - sinceLastMs);
            this.trailingDrain = {
                lease,
                promise,
                timer,
                settle: settlePromise,
            };
            return promise;
        }

        this.cancelScheduledRetry();
        this.lastDrainStartedAtMs = Date.now();
        const promise = run().finally(() => {
            if (this.activeDrain?.promise === promise) {
                this.activeDrain = null;
            }
        });
        this.activeDrain = { lease, promise };
        return promise;
    }

    scheduleRetry(lease: YeeAccountLease, deadlineMs: number, run: () => Promise<void>): void {
        if (!isYeeAccountLeaseCurrent(lease)) {
            return;
        }
        this.cancelScheduledRetry();

        let settlePromise: () => void = () => undefined;
        const promise = new Promise<void>((resolve) => {
            settlePromise = resolve;
        });
        const timer = setTimeout(
            () => {
                if (this.retryDrain?.promise !== promise) {
                    return;
                }
                this.retryDrain = null;
                void this.request(lease, false, run).finally(settlePromise);
            },
            Math.max(0, deadlineMs - Date.now()),
        );
        this.retryDrain = { lease, promise, timer, settle: settlePromise };
    }

    cancelDeferredDrain(): void {
        if (this.trailingDrain === null) {
            return;
        }
        clearTimeout(this.trailingDrain.timer);
        this.trailingDrain.settle();
        this.trailingDrain = null;
    }

    cancelScheduledRetry(): void {
        if (this.retryDrain === null) {
            return;
        }
        clearTimeout(this.retryDrain.timer);
        this.retryDrain.settle();
        this.retryDrain = null;
    }
}
