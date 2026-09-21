import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { withCors } from "../_shared/cors.ts";
import { BNR_FX_URL, createBnrRateHandler } from "./rate.ts";

serve(
  withCors(
    createBnrRateHandler({
      fetchXml: async () => {
        const response = await fetch(BNR_FX_URL, {
          headers: {
            Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
            "User-Agent": "MotionTimisoara/bnr-rate",
          },
        });
        if (!response.ok) throw new Error("bnr-http");
        return await response.text();
      },
    }),
  ),
);
