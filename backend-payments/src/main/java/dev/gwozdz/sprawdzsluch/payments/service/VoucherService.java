package dev.gwozdz.sprawdzsluch.payments.service;

import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class VoucherService {
    
    // Przykładowe vouchery dla celów testowych
    private static final Set<String> VALID_VOUCHERS = Set.of(
            "VOUCHER2024",
            "FREEREPORT",
            "TESTSLUCH",
            "PROMOCJA50"
    );
    
    /**
     * Waliduje voucher
     */
    public boolean validateVoucher(String voucherCode) {
        System.out.println("Walidacja vouchera: " + voucherCode);
        
        if (voucherCode == null || voucherCode.trim().isEmpty()) {
            System.out.println("Pusty kod vouchera");
            return false;
        }
        
        boolean isValid = VALID_VOUCHERS.contains(voucherCode.trim().toUpperCase());
        
        if (isValid) {
            System.out.println("Voucher " + voucherCode + " jest prawidłowy");
        } else {
            System.out.println("Voucher " + voucherCode + " jest nieprawidłowy");
        }
        
        return isValid;
    }
    
    /**
     * Dezaktywuje voucher po użyciu (w przyszłości można rozszerzyć o bazę danych)
     */
    public void deactivateVoucher(String voucherCode) {
        System.out.println("Dezaktywacja vouchera: " + voucherCode);
        // TODO: Implementacja zapisywania użytych voucherów w bazie danych
    }
}