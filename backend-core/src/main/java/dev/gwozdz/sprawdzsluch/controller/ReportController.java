package dev.gwozdz.sprawdzsluch.controller;

import dev.gwozdz.sprawdzsluch.dto.ReportDto;
import dev.gwozdz.sprawdzsluch.dto.ResultDto;
import dev.gwozdz.sprawdzsluch.dto.UserDto;
import dev.gwozdz.sprawdzsluch.service.HtmlService;
import dev.gwozdz.sprawdzsluch.service.PdfService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
public class ReportController {

    private final HtmlService htmlService;
    private final PdfService pdfService;

    public ReportController(HtmlService htmlService, PdfService pdfService)
    {
        this.htmlService = htmlService;
        this.pdfService = pdfService;
    }

    @GetMapping("/report")
    public String getReport(Model model)
    {
        // Dane przykładowe
        UserDto user = new UserDto("Jan Kowalski", 30);
        ReportDto report = new ReportDto("RPT-8AF39KX", LocalDate.now(), "Test tonalny online",
                100, 13000, 29, "lekki ubytek", 30, "lekki ubytek",
                "Zalecana profilaktyczna konsultacja z protetykiem słuchu.");
        List<ResultDto> results = Arrays.asList(
                new ResultDto("500 Hz", 20, "norma", "ok", 22, "lekki", "mild"),
                new ResultDto("1000 Hz", 25, "lekki", "mild", 30, "lekki", "mild"),
                new ResultDto("4000 Hz", 42, "umiarkowany", "moderate", 38, "lekki", "mild")
        );

        List<String> frequencies = Arrays.asList("250 Hz", "500 Hz", "1000 Hz", "2000 Hz", "4000 Hz", "8000 Hz");
        List<Integer> leftEarData = Arrays.asList(18, 20, 25, 28, 42, 38);
        List<Integer> rightEarData = Arrays.asList(15, 22, 30, 26, 38, 35);

        model.addAttribute("user", user);
        model.addAttribute("report", report);
        model.addAttribute("results", results);
        model.addAttribute("frequencies", frequencies);
        model.addAttribute("leftEarData", leftEarData);
        model.addAttribute("rightEarData", rightEarData);

        return "report"; // render HTML w przeglądarce
    }

    @GetMapping("/report/pdf")
    public ResponseEntity<byte[]> getReportPdf()
    {
        // Dane przykładowe
        Map<String, Object> variables = new HashMap<>();
        variables.put("user", new UserDto("Jan Kowalski", 30));
        variables.put("report", new ReportDto("RPT-8AF39KX", LocalDate.now(), "Test tonalny online",
                100, 13000, 29, "lekki ubytek", 30, "lekki ubytek",
                "Zalecana profilaktyczna konsultacja z protetykiem słuchu."));
        variables.put("results", Arrays.asList(
                new ResultDto("500 Hz", 20, "norma", "ok", 22, "lekki", "mild"),
                new ResultDto("1000 Hz", 25, "lekki", "mild", 30, "lekki", "mild"),
                new ResultDto("4000 Hz", 42, "umiarkowany", "moderate", 38, "lekki", "mild")
        ));
        variables.put("frequencies", Arrays.asList("250 Hz", "500 Hz", "1000 Hz", "2000 Hz", "4000 Hz", "8000 Hz"));
        variables.put("leftEarData", Arrays.asList(18, 20, 25, 28, 42, 38));
        variables.put("rightEarData", Arrays.asList(15, 22, 30, 26, 38, 35));

        // Render Thymeleaf -> HTML
        String html = htmlService.renderHtml("report", variables);

        // Zamiana HTML -> PDF
        byte[] pdf = pdfService.generatePdfFromHtml(html);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=raport.pdf")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
