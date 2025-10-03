package dev.gwozdz.audiogram.service;

import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.ExchangeStrategies;
import org.springframework.web.reactive.function.client.WebClient;

import java.util.Map;

@Service
public class PdfService {

    private final WebClient client;

    public PdfService()
    {
        // Zwiększamy limit bufora do 16MB
        ExchangeStrategies strategies = ExchangeStrategies.builder()
                .codecs(codecs -> codecs.defaultCodecs().maxInMemorySize(16 * 1024 * 1024))
                .build();

        this.client = WebClient.builder()
                .baseUrl("http://localhost:3000")
                .exchangeStrategies(strategies)
                .build();
    }

    public byte[] generatePdfFromHtml(String html)
    {
        return client.post()
                .uri("/generate-pdf")
                .bodyValue(Map.of("html", html))
                .retrieve()
                .bodyToMono(byte[].class)
                .block();
    }
}