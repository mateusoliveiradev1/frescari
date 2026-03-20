import {
  createDbLotFreshnessRepository,
  createInlineLotEventPublisher,
  runLotFreshnessPass,
  type LotFreshnessRunSummary,
} from "@frescari/api/workers/lot-freshness";
import {
  createDbDeliveryDelayNotifier,
  createDbDeliveryDelayRepository,
  createDbLotNotificationEmitter,
  runDeliveryDelayScanPass,
  type DeliveryDelayScanSummary,
} from "@frescari/api/workers/notification-worker";

export async function runLotFreshnessCronJob(
  now = new Date(),
): Promise<LotFreshnessRunSummary> {
  const repository = createDbLotFreshnessRepository();
  const emitter = createDbLotNotificationEmitter();
  const publisher = createInlineLotEventPublisher(emitter);

  return runLotFreshnessPass({
    repository,
    publisher,
    now,
  });
}

export async function runDeliveryDelayCronJob(
  now = new Date(),
): Promise<DeliveryDelayScanSummary> {
  const repository = createDbDeliveryDelayRepository();
  const notifier = createDbDeliveryDelayNotifier();

  return runDeliveryDelayScanPass({
    repository,
    notifier,
    now,
  });
}
