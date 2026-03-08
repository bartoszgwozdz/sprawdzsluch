package dev.gwozdz.sprawdzsluch.filter;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

/**
 * Filter ustawiający pola MDC dla każdego requestu:
 * - correlationId: pobrany z nagłówka X-Correlation-Id lub wygenerowany UUID
 *
 * Wartość correlationId jest też przekazywana w odpowiedzi jako nagłówek,
 * żeby klient mógł śledzić request w logach.
 *
 * testId jest ustawiany przez ResultService po wygenerowaniu/rozpoznaniu testId.
 */
@Component
@Order(1)
public class MdcFilter implements Filter {

    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    public static final String MDC_CORRELATION_ID = "correlationId";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String correlationId = httpRequest.getHeader(CORRELATION_ID_HEADER);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }

        MDC.put(MDC_CORRELATION_ID, correlationId);
        // Zwróć correlationId w odpowiedzi — ułatwia debugowanie
        httpResponse.addHeader(CORRELATION_ID_HEADER, correlationId);

        try {
            chain.doFilter(request, response);
        } finally {
            // ZAWSZE czyść MDC — wątki są reużywane przez Tomcat
            MDC.clear();
        }
    }
}
