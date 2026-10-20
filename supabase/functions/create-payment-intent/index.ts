import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getUser, supabaseAdmin } from "../_shared/supabase.ts";
import { authorizedRonCharge } from "../_shared/payment-charge.ts";
import { paymentRecipient } from "../_shared/payment-recipient.ts";
import { preparePaymentIntent } from "../_shared/payment-intent.ts";
import { withCors } from "../_shared/cors.ts";
import { calculatePlatformFee, getStripe } from "../_shared/stripe.ts";

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const user = await getUser(req);
    const { enrollmentId } = await req.json();

    const { data: payment, error: payErr } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("enrollment_id", enrollmentId)
      .single();
    if (payErr || !payment) {
      return new Response(
        JSON.stringify({ error: "Payment not initialized" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    if (payment.method !== "CARD") {
      return new Response(
        JSON.stringify({
          error: "Payment intent required only for card payments",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { data: enrollment } = await supabaseAdmin
      .from("enrollments")
      .select("*")
      .eq("id", enrollmentId)
      .single();
    if (!enrollment) {
      return new Response(JSON.stringify({ error: "Enrollment not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const amountInBani = await authorizedRonCharge(
      supabaseAdmin,
      user.id,
      enrollment,
      payment,
    );

    const recipient = await paymentRecipient(supabaseAdmin, enrollment);
    const destinationAccountId = recipient.accountId;
    const destinationType = recipient.type;
    const { coachId, clubId } = recipient;

    const stripe = getStripe();
    const currencyLower = "ron";

    const params: any = {
      amount: amountInBani,
      currency: currencyLower,
      payment_method_types: ["card"],
      metadata: {
        enrollmentId: enrollment.id,
        paymentId: payment.id,
      },
    };

    if (destinationAccountId) {
      const fee = calculatePlatformFee(amountInBani);
      params.application_fee_amount = fee.platformFeeTotal;
      params.transfer_data = { destination: destinationAccountId };
      params.metadata.destinationType = destinationType;
      params.metadata.platformFee = fee.platformFeeTotal.toString();
      params.metadata.recipientAmount = fee.recipientAmount.toString();
      if (coachId) params.metadata.coachId = coachId;
      if (destinationType === "CLUB" && clubId) {
        params.metadata.clubId = clubId;
      }
    }

    if (payment.billing_email) {
      params.receipt_email = payment.billing_email;
    }

    const prepared = await preparePaymentIntent(
      supabaseAdmin,
      stripe,
      payment,
      params,
    );

    return new Response(JSON.stringify(prepared), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
);
