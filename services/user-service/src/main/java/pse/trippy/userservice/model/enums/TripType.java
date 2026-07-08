package pse.trippy.userservice.model.enums;

/**
 * The overall vibe or theme a traveller wants for a trip.
 *
 * <p>Captured as a trip preference and used by the AI service to bias
 * itinerary suggestions towards the desired experience.
 */
public enum TripType {

    /** Coastal, beach, and seaside focused. */
    BEACH,

    /** Alpine, hiking, and mountain focused. */
    MOUNTAIN,

    /** Urban city break with landmarks and nightlife. */
    CITY,

    /** Outdoors, parks, and natural landscapes. */
    NATURE,

    /** Active, adrenaline, and exploration focused. */
    ADVENTURE,

    /** History, museums, and local culture focused. */
    CULTURE
}
