package dev.gwozdz.sprawdzsluch.entity;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "payments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    private String id; 

    private String userEmail;         // email klienta
    private String testId;            // ID testu słuchu (do raportu)
    private String paynowPaymentId;   // ID transakcji Paynow

    private PaymentStatus status;     

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}


