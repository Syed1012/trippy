package pse.trippy.userservice.model.enums;

/**
 * Budget tier a traveller expects for a trip.
 *
 * <p>Used both for package cost estimates and as an AI itinerary hint.
 */
public enum BudgetTier {

    /** Budget-friendly, cost-conscious choices. */
    ECONOMY,

    /** Balanced comfort and value. */
    MODERATE,

    /** Premium, high-end experiences. */
    LUXURY
}
