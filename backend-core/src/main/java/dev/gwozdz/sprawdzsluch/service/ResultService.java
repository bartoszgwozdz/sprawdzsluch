package dev.gwozdz.sprawdzsluch.service;

import org.springframework.stereotype.Service;
import dev.gwozdz.sprawdzsluch.entity.HearingResult;
import dev.gwozdz.sprawdzsluch.repository.HearingResultRepository;

import java.util.HashMap;
import java.util.Map;

@Service
public class ResultService {
    private final HearingResultRepository repo;

    public ResultService(HearingResultRepository repo)
    {
        this.repo = repo;
    }

    public HearingResult save(HearingResult result)
    {
        return repo.save(result);
    }

    public HearingResult find(Long id)
    {
        return repo.findById(id).orElseThrow();
    }

    public Map<String, Object> getVariablesFromResult(HearingResult result)
    {
        return HashMap.newHashMap(1);
    }
}

