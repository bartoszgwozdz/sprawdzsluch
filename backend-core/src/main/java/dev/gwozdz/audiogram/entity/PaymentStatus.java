package dev.gwozdz.audiogram.entity;

public enum PaymentStatus {
    INITIATED,    // Nowa płatność (Paynow -> NEW)
    IN_PROGRESS,  // W trakcie (Paynow -> PENDING)
    PAID,         // Sukces (Paynow -> CONFIRMED)
    FAILED,       // Nieudana (Paynow -> REJECTED / ERROR)
    CANCELED      // Anulowana przez klienta (Paynow -> CANCELED)
}

