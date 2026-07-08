package pse.trippy.userservice.model.enums;

/**
 * Optional weather preference a traveller has for a trip.
 *
 * <p>Used by the AI service as a soft hint when suggesting destinations
 * and activities.
 */
public enum PreferredWeather {

    /** Warm and sunny climates. */
    WARM,

    /** Mild, temperate conditions. */
    MILD,

    /** Cold or snowy climates. */
    COLD,

    /** No specific weather preference. */
    ANY
}
