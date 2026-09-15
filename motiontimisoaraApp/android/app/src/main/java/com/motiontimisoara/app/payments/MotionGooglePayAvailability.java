package com.motiontimisoara.app.payments;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.google.android.gms.wallet.IsReadyToPayRequest;
import com.google.android.gms.wallet.Wallet;
import com.google.android.gms.wallet.WalletConstants;
import com.stripe.android.GooglePayJsonFactory;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

public final class MotionGooglePayAvailability {
    private MotionGooglePayAvailability() {}

    public static void check(Context context, Consumer<Boolean> callback) {
        Handler handler = new Handler(Looper.getMainLooper());
        AtomicBoolean pending = new AtomicBoolean(true);
        Consumer<Boolean> finish = ready -> {
            if (pending.compareAndSet(true, false)) {
                callback.accept(ready);
            }
        };
        Runnable deadline = () -> finish.accept(false);
        handler.postDelayed(deadline, 5_000);
        try {
            String request = new GooglePayJsonFactory(context, false)
                .createIsReadyToPayRequest(new GooglePayJsonFactory.BillingAddressParameters(), true, true)
                .toString();
            Wallet.getPaymentsClient(context, new Wallet.WalletOptions.Builder()
                .setEnvironment(WalletConstants.ENVIRONMENT_TEST)
                .build())
                .isReadyToPay(IsReadyToPayRequest.fromJson(request))
                .addOnCompleteListener(task -> {
                    handler.removeCallbacks(deadline);
                    finish.accept(task.isSuccessful() && Boolean.TRUE.equals(task.getResult()));
                });
        } catch (Exception exception) {
            handler.removeCallbacks(deadline);
            finish.accept(false);
        }
    }
}
