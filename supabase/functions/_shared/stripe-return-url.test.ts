import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { stripeReturnBase } from "./stripe-return-url.ts";

Deno.test("production origin is used as the Stripe return base", () => {
  assertEquals(stripeReturnBase("https://motionromania.com", undefined), "https://motionromania.com");
  assertEquals(stripeReturnBase("https://www.motionromania.com", undefined), "https://www.motionromania.com");
});

Deno.test("local and deploy preview origins return to themselves", () => {
  assertEquals(stripeReturnBase("http://127.0.0.1:3017", undefined), "http://127.0.0.1:3017");
  assertEquals(stripeReturnBase("http://localhost:3017", undefined), "http://localhost:3017");
  assertEquals(
    stripeReturnBase("https://deploy-preview-150--motiontimisoara.netlify.app", undefined),
    "https://deploy-preview-150--motiontimisoara.netlify.app",
  );
  assertEquals(
    stripeReturnBase("https://master--motiontimisoara.netlify.app", undefined),
    "https://master--motiontimisoara.netlify.app",
  );
});

Deno.test("missing configuration falls back to production, never localhost", () => {
  assertEquals(stripeReturnBase(null, undefined), "https://motionromania.com");
  assertEquals(stripeReturnBase(null, ""), "https://motionromania.com");
});

Deno.test("unknown or native origins use the configured origin", () => {
  assertEquals(stripeReturnBase("https://evil.example", undefined), "https://motionromania.com");
  assertEquals(stripeReturnBase("https://motionromania.com.evil.example", undefined), "https://motionromania.com");
  assertEquals(stripeReturnBase("capacitor://localhost", "https://motionromania.com/"), "https://motionromania.com");
  assertEquals(stripeReturnBase("https://localhost", undefined), "https://motionromania.com");
  assertEquals(stripeReturnBase("https://motiontimisoara.com", undefined), "https://motionromania.com");
  assertEquals(stripeReturnBase("https://www.motiontimisoara.com", undefined), "https://motionromania.com");
});
