import type {
    DeliveryControlBaseDelivery,
    DeliveryExternalSignal,
    DeliveryExternalSignalsResolver,
} from './delivery-control';

function buildNoRiskSignals(): DeliveryExternalSignal[] {
    return [
        {
            source: 'weather',
            status: 'available',
            impact: 'none',
            summary: 'stub de clima sem alertas ativos',
        },
        {
            source: 'traffic',
            status: 'available',
            impact: 'none',
            summary: 'stub de transito com fluxo normal',
        },
        {
            source: 'closures',
            status: 'available',
            impact: 'none',
            summary: 'stub de vias sem interdicoes relevantes',
        },
    ];
}

export const stubDeliveryExternalSignalsResolver: DeliveryExternalSignalsResolver<DeliveryControlBaseDelivery> = async () => {
    return buildNoRiskSignals();
};
