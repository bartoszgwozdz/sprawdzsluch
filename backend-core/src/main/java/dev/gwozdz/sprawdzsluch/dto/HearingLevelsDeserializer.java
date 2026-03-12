package dev.gwozdz.sprawdzsluch.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Deserializuje hearingLevels z dwóch formatów:
 * - obiekt (nowy):  {"1000": 0.5, "2000": 0.3}
 * - tablica (stary frontend): [{"frequency": 1000, "gain": 0.5}, ...]
 */
public class HearingLevelsDeserializer extends StdDeserializer<Map<Integer, Double>> {

  public HearingLevelsDeserializer() {
    super(Map.class);
  }

  @Override
  public Map<Integer, Double> deserialize(JsonParser p, DeserializationContext ctx)
      throws IOException {

    Map<Integer, Double> result = new LinkedHashMap<>();

    if (p.currentToken() == JsonToken.START_OBJECT) {
      // Format: {"1000": 0.5, "2000": 0.3}
      while (p.nextToken() != JsonToken.END_OBJECT) {
        int frequency = Integer.parseInt(p.currentName());
        p.nextToken();
        double gain = p.getDoubleValue();
        result.put(frequency, gain);
      }

    } else if (p.currentToken() == JsonToken.START_ARRAY) {
      // Format: [{"frequency": 1000, "gain": 0.00001}, ...]
      while (p.nextToken() != JsonToken.END_ARRAY) {
        Integer frequency = null;
        Double gain = null;
        while (p.nextToken() != JsonToken.END_OBJECT) {
          String fieldName = p.currentName();
          p.nextToken();
          if ("frequency".equals(fieldName)) {
            frequency = p.getIntValue();
          } else if ("gain".equals(fieldName)) {
            gain = p.getDoubleValue();
          }
        }
        if (frequency != null && gain != null) {
          result.put(frequency, gain);
        }
      }
    }

    return result;
  }
}
