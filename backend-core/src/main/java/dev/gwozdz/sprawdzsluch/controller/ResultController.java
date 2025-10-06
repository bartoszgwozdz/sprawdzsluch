package dev.gwozdz.sprawdzsluch.controller;

import org.springframework.web.bind.annotation.*;
import dev.gwozdz.sprawdzsluch.entity.HearingResult;
import dev.gwozdz.sprawdzsluch.service.ResultService;

@RestController
@RequestMapping("/api/results")
public class ResultController {
    private final ResultService resultService;

    public ResultController(ResultService resultService)
    {
        this.resultService = resultService;
    }

    @PostMapping
    public HearingResult save(@RequestBody HearingResult result)
    {
        result.setStatus("NEW");
        return resultService.save(result);
    }
}

