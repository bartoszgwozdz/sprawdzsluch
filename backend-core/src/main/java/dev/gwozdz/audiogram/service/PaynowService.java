package dev.gwozdz.audiogram.service;

import dev.gwozdz.audiogram.entity.Payment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
public class PaynowService {

    @Value("${paynow.apiKey}")
    private String apiKey;

    @Value("${paynow.signatureKey}")
    private String signatureKey;

    @Value("${paynow.apiUrl}")
    private String apiUrl;

    @Value("${paynow.redirectUrl}")
    private String redirectUrl;

    @Value("${paynow.notifyUrl}")
    private String notifyUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public String createPayment(Payment payment) throws Exception
    {
        Map<String, Object> reqBody = new HashMap<>();
//        reqBody.put("amount", payment.getAmountCents());
//        reqBody.put("currency", payment.getCurrency());
        reqBody.put("externalId", payment.getId().toString());
        reqBody.put("description", "Badanie słuchu online");
        reqBody.put("continueUrl", redirectUrl);
        reqBody.put("notificationUrl", notifyUrl);

        String jsonBody = new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(reqBody);
        String signature = HmacUtil.sign(jsonBody, signatureKey);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Api-Key", apiKey);
        headers.set("Signature", signature);

        HttpEntity<String> entity = new HttpEntity<>(jsonBody, headers);

        ResponseEntity<Map> resp = restTemplate.exchange(
                apiUrl + "/payments",
                HttpMethod.POST,
                entity,
                Map.class
        );

        if (resp.getStatusCode() == HttpStatus.OK && resp.getBody() != null) {
            Map body = resp.getBody();
            String paymentId = (String) body.get("paymentId");
            Map<String, String> links = (Map<String, String>) body.get("links");
            payment.setPaynowPaymentId(paymentId);
            return links.get("redirectUrl"); // tutaj przekierowujesz użytkownika
        }
        throw new RuntimeException("Payment creation failed: " + resp);
    }
}

