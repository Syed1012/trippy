package pse.trippy.paymentservice.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import pse.trippy.paymentservice.dto.request.AddPaymentMethodRequest;
import pse.trippy.paymentservice.dto.request.CancelSubscriptionRequest;
import pse.trippy.paymentservice.dto.request.CheckoutRequest;
import pse.trippy.paymentservice.dto.request.PaymentConfirmationRequest;
import pse.trippy.paymentservice.dto.response.PaymentConfirmationResponse;
import pse.trippy.paymentservice.dto.response.CheckoutResponse;
import pse.trippy.paymentservice.dto.response.PaymentMethodResponse;
import pse.trippy.paymentservice.dto.response.PlanResponse;
import pse.trippy.paymentservice.dto.response.SubscriptionResponse;
import pse.trippy.paymentservice.dto.response.TransactionResponse;
import pse.trippy.paymentservice.service.PaymentMethodService;
import pse.trippy.paymentservice.service.PaymentService;
import pse.trippy.paymentservice.service.SubscriptionService;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService paymentService;
    private final SubscriptionService subscriptionService;
    private final PaymentMethodService paymentMethodService;

    @GetMapping("/plans")
    public ResponseEntity<List<PlanResponse>> getPlans() {
        return ResponseEntity.ok(paymentService.getAvailablePlans());
    }

    @PostMapping("/checkout")
    public ResponseEntity<CheckoutResponse> checkout(
            @Valid @RequestBody CheckoutRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        CheckoutResponse response = paymentService.checkout(userId, request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/subscription/confirm")
    public ResponseEntity<PaymentConfirmationResponse> confirmPayment(
            @Valid @RequestBody PaymentConfirmationRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        PaymentConfirmationResponse response = subscriptionService.confirmPayment(userId, request);
        return ResponseEntity.ok(response); 
    }

    @GetMapping("/subscription")
    public ResponseEntity<SubscriptionResponse> getSubscription(
            @RequestHeader("X-User-Id") UUID userId) {
        SubscriptionResponse response = subscriptionService.getSubscription(userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/subscription/cancel")
    public ResponseEntity<SubscriptionResponse> cancelSubscription(
            @Valid @RequestBody CancelSubscriptionRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        SubscriptionResponse response = subscriptionService.cancelSubscription(userId, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<TransactionResponse>> getTransactions(
            @RequestHeader("X-User-Id") UUID userId) {
        List<TransactionResponse> response = paymentService.getTransactions(userId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/methods")
    public ResponseEntity<PaymentMethodResponse> addPaymentMethod(
            @Valid @RequestBody AddPaymentMethodRequest request,
            @RequestHeader("X-User-Id") UUID userId) {
        PaymentMethodResponse response = paymentMethodService.addPaymentMethod(userId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/methods")
    public ResponseEntity<List<PaymentMethodResponse>> getPaymentMethods(
            @RequestHeader("X-User-Id") UUID userId) {
        List<PaymentMethodResponse> response = paymentMethodService.getPaymentMethods(userId);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/methods/{paymentMethodId}")
    public ResponseEntity<Void> deletePaymentMethod(
            @PathVariable UUID paymentMethodId,
            @RequestHeader("X-User-Id") UUID userId) {
        paymentMethodService.deletePaymentMethod(userId, paymentMethodId);
        return ResponseEntity.noContent().build();
    }
}
