export type LotStatus = 'fresco' | 'last_chance' | 'vencido';

/**
 * Calculates the status of a lot based on its expiration date.
 * 
 * Rules:
 * - Current date > expirationDate -> 'vencido'
 * - expirationDate within 48 hours from now -> 'last_chance'
 * - Otherwise -> 'fresco'
 */
export function calculateLotStatus(expiryDateStr: string | Date): LotStatus {
    const now = new Date();
    const expiry = new Date(expiryDateStr);

    // Normalize to UTC noon to match how we handle dates in the DB/Frontend mostly?
    // Actually, the prompt says "today > expirationDate", so let's use exact time comparison.
    // If we want to be safe with "day" precision, we might need more logic, 
    // but the 48h rule implies time sensitivity.

    if (expiry < now) {
        return 'vencido';
    }

    const fortyEightHoursInMs = 48 * 60 * 60 * 1000;
    const timeUntilExpiry = expiry.getTime() - now.getTime();

    if (timeUntilExpiry <= fortyEightHoursInMs) {
        return 'last_chance';
    }

    return 'fresco';
}
