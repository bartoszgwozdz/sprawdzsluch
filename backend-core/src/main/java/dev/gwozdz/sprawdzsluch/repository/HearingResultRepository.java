package dev.gwozdz.sprawdzsluch.repository;

import dev.gwozdz.sprawdzsluch.entity.HearingResult;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface HearingResultRepository extends MongoRepository<HearingResult, Long> {
}
