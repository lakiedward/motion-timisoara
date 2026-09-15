package com.motiontimisoara.app.payments;

import androidx.lifecycle.Lifecycle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.motiontimisoara.app.MainActivity;
import com.stripe.android.PaymentConfiguration;
import com.stripe.android.paymentsheet.PaymentSheet;
import com.stripe.android.paymentsheet.PaymentSheetResult;

@CapacitorPlugin(name = "MotionPayments")
public final class MotionPaymentsPlugin extends Plugin {
    private final MotionPaymentSession<PluginCall> session = new MotionPaymentSession<>();

    @PluginMethod
    public void availability(PluginCall call) {
        if (!validConfiguration(call)) {
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                PaymentConfiguration.init(getContext(), call.getString("publishableKey"));
                MotionGooglePayAvailability.check(getContext(), ready -> {
                    JSObject result = new JSObject();
                    result.put("googlePay", ready);
                    result.put("testMode", true);
                    call.resolve(result);
                });
            } catch (Exception exception) {
                call.reject("Configurarea plății nu este disponibilă. Reîncearcă.", "PAYMENT_CONFIGURATION");
            }
        });
    }

    @PluginMethod
    public void confirm(PluginCall call) {
        if (!validConfiguration(call)) {
            return;
        }
        String clientSecret = call.getString("clientSecret");
        if (clientSecret == null || !clientSecret.matches("^pi_[A-Za-z0-9]+_secret_[A-Za-z0-9]+$")) {
            call.reject("Datele plății nu sunt valide. Reîncearcă din înscrieri.", "INVALID_PAYMENT");
            return;
        }
        if (!session.begin(call)) {
            call.reject("O confirmare a plății este deja deschisă.", "PAYMENT_IN_PROGRESS");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (!canPresent(call)) {
                return;
            }
            try {
                PaymentConfiguration.init(getContext(), call.getString("publishableKey"));
                MotionGooglePayAvailability.check(getContext(), ready -> present(call, clientSecret, ready));
            } catch (Exception exception) {
                failCurrent(call);
            }
        });
    }

    private boolean validConfiguration(PluginCall call) {
        String key = call.getString("publishableKey");
        if (key == null || !key.matches("^pk_test_[A-Za-z0-9]+$")) {
            call.reject("Plata Android este disponibilă momentan numai în modul de test.", "PAYMENT_CONFIGURATION");
            return false;
        }
        return true;
    }

    private boolean canPresent(PluginCall call) {
        if (!session.isCurrent(call)) {
            return false;
        }
        MainActivity activity = (MainActivity) getActivity();
        if (activity.isFinishing() || activity.isDestroyed()
            || !activity.getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.RESUMED)) {
            session.finish();
            call.reject("Revino în aplicație și reîncearcă plata din înscrieri.", "PAYMENT_INTERRUPTED");
            return false;
        }
        return true;
    }

    private void present(PluginCall call, String clientSecret, boolean googlePay) {
        if (!canPresent(call)) {
            return;
        }
        try {
            PaymentSheet.Configuration.Builder configuration = new PaymentSheet.Configuration.Builder("Motion Timișoara")
                .allowsDelayedPaymentMethods(false)
                .link(new PaymentSheet.LinkConfiguration(PaymentSheet.LinkConfiguration.Display.Never))
                .defaultBillingDetails(billing(call.getObject("billing", new JSObject())));
            if (googlePay) {
                configuration.googlePay(new PaymentSheet.GooglePayConfiguration(
                    PaymentSheet.GooglePayConfiguration.Environment.Test, "RO", "RON"
                ));
            }
            ((MainActivity) getActivity()).presentPayment(clientSecret, configuration.build());
        } catch (Exception exception) {
            failCurrent(call);
        }
    }

    private PaymentSheet.BillingDetails billing(JSObject input) {
        return new PaymentSheet.BillingDetails.Builder()
            .name(input.getString("name"))
            .email(input.getString("email"))
            .address(new PaymentSheet.Address.Builder()
                .country("RO")
                .line1(input.getString("addressLine1"))
                .city(input.getString("city"))
                .postalCode(input.getString("postalCode")))
            .build();
    }

    private void failCurrent(PluginCall call) {
        if (session.isCurrent(call)) {
            session.finish();
            call.reject("Plata nu a putut fi confirmată. Verifică înscrierea și reîncearcă.", "PAYMENT_FAILED");
        }
    }

    public void onPaymentResult(PaymentSheetResult paymentResult) {
        PluginCall call = session.finish();
        String status = paymentResult instanceof PaymentSheetResult.Completed
            ? "completed"
            : paymentResult instanceof PaymentSheetResult.Canceled ? "canceled" : "failed";
        JSObject result = new JSObject();
        result.put("status", status);
        if (call != null) {
            if ("failed".equals(status)) {
                call.reject("Plata nu a putut fi confirmată. Verifică înscrierea și reîncearcă.", "PAYMENT_FAILED");
            } else {
                call.resolve(result);
            }
        }
        JSObject event = new JSObject();
        event.put("status", status);
        event.put("recovered", call == null);
        notifyListeners("paymentResult", event, true);
    }

    @Override
    protected void handleOnDestroy() {
        PluginCall call = session.finish();
        if (call != null) {
            call.reject("Plata a fost întreruptă. Verifică înscrierea când revii în aplicație.", "PAYMENT_INTERRUPTED");
        }
    }
}
