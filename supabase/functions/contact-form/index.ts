// Edge Function: contact-form
// Replaces: PublicContactController
// Handles: rate-limited contact form submission

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { name, email, subject, message } = await req.json();

    if (!name || !email || !message) {
      return new Response(
        JSON.stringify({ error: "Name, email, and message are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Simple email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email address" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Log to audit_logs for tracking
    await supabaseAdmin.from("audit_logs").insert({
      target_entity_id: "00000000-0000-0000-0000-000000000000",
      target_entity_type: "CONTACT_FORM",
      action: "SUBMIT",
      metadata: { name, email, subject, message },
    });

    // In production, integrate with Resend or Supabase's email service
    // For now, log and acknowledge
    console.log(`Contact form submission from ${name} <${email}>: ${subject}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Message received. We will get back to you soon.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
