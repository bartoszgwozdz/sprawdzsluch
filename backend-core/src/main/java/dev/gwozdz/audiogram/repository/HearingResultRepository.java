package dev.gwozdz.audiogram.repository;

import dev.gwozdz.audiogram.entity.HearingResult;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HearingResultRepository extends JpaRepository<HearingResult, Long> {
}
