package pse.trippy.paymentservice.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import pse.trippy.paymentservice.dto.PaymentRequest;
import pse.trippy.paymentservice.dto.request.CheckoutRequest;
import pse.trippy.paymentservice.dto.response.FeatureResponse;
import pse.trippy.paymentservice.dto.response.PaymentResponse;
import pse.trippy.paymentservice.dto.response.PlanResponse;
import pse.trippy.paymentservice.dto.response.CheckoutResponse;
import pse.trippy.paymentservice.dto.response.TransactionResponse;
import pse.trippy.paymentservice.exception.InvalidPlanException;
import pse.trippy.paymentservice.repository.TransactionRepository;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Map;
import java.util.List;
import java.util.UUID;

@Service
public class PaymentService {

    private static final Logger logger = LoggerFactory.getLogger(PaymentService.class);
    private final PaymentValidator paymentValidator;
    private final TransactionRepository transactionRepository;

    private static final Map<String, BigDecimal> PLAN_PRICING = Map.of(
            "premium_monthly", new BigDecimal("9.99"),
            "premium_yearly", new BigDecimal("99.99"),
            "enterprise_monthly", new BigDecimal("29.99"),
            "enterprise_yearly", new BigDecimal("299.99")
    );

    public PaymentService(PaymentValidator paymentValidator, TransactionRepository transactionRepository) {
        this.paymentValidator = paymentValidator;
        this.transactionRepository = transactionRepository;
    }

    public PaymentResponse processPayment(PaymentRequest request) {
        // 1. Validate the payment request
        paymentValidator.validatePayment(request);

        // 2. Interact with the payment gateway (e.g., Stripe, Braintree)
        // This is where you would use the paymentMethodToken to create a charge.
        logger.info("Processing payment for user {} with amount {}", request.userId(), request.amount());

        // 3. Mocking a successful payment for now
        String transactionId = "txn_" + UUID.randomUUID().toString();
        logger.info("Payment successful. Transaction ID: {}", transactionId);

        // 4. Return a response
        return new PaymentResponse(transactionId, "SUCCESS");
    }

    public CheckoutResponse checkout(UUID userId, CheckoutRequest request) {
        String planId = request.planId();
        planId = planId.toLowerCase();
        BigDecimal amount = PLAN_PRICING.get(planId);

        if (amount == null) {
            logger.warn("Checkout failed for user {}: Invalid plan ID '{}'", userId, planId);
            throw new InvalidPlanException(planId);
        }

        // In a real system, this would create a charge with a payment gateway
        // and return a pending transaction. For now, we mock success.
        UUID transactionId = UUID.randomUUID();
        logger.info("Checkout initiated for user {} with plan {} for amount {}. Transaction ID: {}",
                userId, planId, amount, transactionId);

        return CheckoutResponse.builder()
                .transactionId(transactionId)
                .status("INITIATED")
                .plan(planId)
                .amount(new CheckoutResponse.Amount(amount, "EUR"))
                .message("Checkout initiated. Proceed to confirmation.")
                .build();
    }

    public List<TransactionResponse> getTransactions(UUID userId) {
        logger.info("Fetching transactions for user {}", userId);
        return transactionRepository.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(t -> new TransactionResponse(
                        t.getId(),
                        t.getUserId(),
                        t.getAmount(),
                        t.getCurrency(),
                        t.getType().name(),
                        t.getStatus().name(),
                        t.getPlanId().name() + " subscription",
                        t.getCreatedAt()))
                .toList();
    }

    public List<PlanResponse> getAvailablePlans() {
        PlanResponse premium = new PlanResponse(
                "premium",
                "Premium",
                "For power users and frequent travelers",
                Arrays.asList(
                        new PlanResponse.Price("premium_monthly", "Monthly", new BigDecimal("9.99"), "EUR"),
                        new PlanResponse.Price("premium_yearly", "Yearly", new BigDecimal("99.99"), "EUR")
                ),
                Arrays.asList(
                        new FeatureResponse("Unlimited trips", true),
                        new FeatureResponse("AI itinerary generation", true),
                        new FeatureResponse("Real-time collaboration", true),
                        new FeatureResponse("Priority support", false)
                )
        );

        PlanResponse enterprise = new PlanResponse(
                "enterprise",
                "Enterprise",
                "For teams and travel agencies",
                Arrays.asList(
                        new PlanResponse.Price("enterprise_monthly", "Monthly", new BigDecimal("29.99"), "EUR"),
                        new PlanResponse.Price("enterprise_yearly", "Yearly", new BigDecimal("299.99"), "EUR")
                ),
                Arrays.asList(
                        new FeatureResponse("All Premium features", true),
                        new FeatureResponse("Team management", true),
                        new FeatureResponse("Custom branding", true),
                        new FeatureResponse("Priority support", true)
                )
        );

        return Arrays.asList(premium, enterprise);
    }
}
