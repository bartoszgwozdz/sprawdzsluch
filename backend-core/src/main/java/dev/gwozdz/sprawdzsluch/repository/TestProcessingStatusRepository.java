package dev.gwozdz.sprawdzsluch.repository;

import dev.gwozdz.sprawdzsluch.entity.TestProcessingStatus;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TestProcessingStatusRepository extends MongoRepository<TestProcessingStatus, String> {
    
    Optional<TestProcessingStatus> findByTestId(String testId);
    
    boolean existsByTestId(String testId);
}