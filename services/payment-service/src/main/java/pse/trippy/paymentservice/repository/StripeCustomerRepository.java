package pse.trippy.paymentservice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import pse.trippy.paymentservice.model.entity.StripeCustomer;

import java.util.Optional;
import java.util.UUID;

public interface StripeCustomerRepository extends JpaRepository<StripeCustomer, UUID> {
    Optional<StripeCustomer> findByStripeCustomerId(String stripeCustomerId);
}