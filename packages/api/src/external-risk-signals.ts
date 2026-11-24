import type {
  DeliveryControlBaseDelivery,
  DeliveryExternalSignal,
  DeliveryExternalSignalsResolver,
} from "./delivery-control";

function buildNoRiskSignals(): DeliveryExternalSignal[] {
  return [
    {
      source: "weather",
      status: "available",
      impact: "none",
      summary: "Clima: monitoramento automatico ainda nao integrado",
    },
    {
      source: "traffic",
      status: "available",
      impact: "none",
      summary: "Transito: monitoramento automatico ainda nao integrado",
    },
    {
      source: "closures",
      status: "available",
      impact: "none",
      summary: "Interdicoes: monitoramento automatico ainda nao integrado",
    },
  ];
}

export const stubDeliveryExternalSignalsResolver: DeliveryExternalSignalsResolver<
  DeliveryControlBaseDelivery
> = async () => {
  return buildNoRiskSignals();
};
