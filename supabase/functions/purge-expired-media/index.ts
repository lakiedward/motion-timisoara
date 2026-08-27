// Edge Function: purge-expired-media
//
// Șterge filmările de la antrenament cărora le-a trecut termenul.
//
// Politica agreată cu proprietarul pe 2026-08-26: filmările se șterg la 30 de
// zile, pozele rămân. `expires_at` se scrie la încărcare (gol pentru poze), deci
// funcția asta nu decide nimic — doar duce la capăt ce s-a hotărât atunci.
//
// Rulează din pg_cron, zilnic. Nu e o acțiune de utilizator, deci nu are gardă de
// rol: cere direct cheia de service, comparată cu cea din mediu.

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { withCors } from "../_shared/cors.ts";

const BUCKET = "announcement-media";
/** Câte rânduri se iau într-o rulare. Restul rămân pentru rularea următoare. */
const LOT = 500;
/** Câte căi se trimit odată la Storage. */
const BUCATA = 100;

function bucati<T>(lista: T[], marime: number): T[][] {
  const iesire: T[][] = [];
  for (let i = 0; i < lista.length; i += marime) {
    iesire.push(lista.slice(i, i + marime));
  }
  return iesire;
}

serve(
  withCors(async (req: Request) => {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Poarta: doar cine are cheia de service poate cere ștergerea.
    //
    // Supabase verifică deja JWT-ul înainte să ajungă cererea aici, dar asta lasă
    // să treacă și cheia anon, care e publică. Verificarea de mai jos e cea care
    // contează: apelantul e pg_cron, nu un om cu sesiune.
    const cheie = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const trimisa = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!cheie || trimisa !== cheie) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const acum = new Date().toISOString();
    const { data: expirate, error: eroareCitire } = await supabaseAdmin
      .from("announcement_attachments")
      .select("id, storage_path")
      .not("expires_at", "is", null)
      .lte("expires_at", acum)
      .limit(LOT);

    if (eroareCitire) {
      console.error("Nu am putut citi atașamentele expirate:", eroareCitire);
      return new Response(JSON.stringify({ error: "read_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const randuri = expirate ?? [];
    if (randuri.length === 0) {
      return new Response(
        JSON.stringify({ verificate: 0, fisiere_sterse: 0, randuri_sterse: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Fișierele se scot ÎNAINTE de rânduri. Invers, un rând șters ar lăsa
    // fișierul în bucket fără nimic care să-l pomenească — deci fără nimeni care
    // să-l mai poată găsi vreodată ca să-l scoată.
    const deSters = randuri.filter((r) => r.storage_path);
    const idReusite: string[] = randuri.filter((r) => !r.storage_path).map((r) => r.id);
    let fisiereSterse = 0;

    for (const bucata of bucati(deSters, BUCATA)) {
      const cai = bucata.map((r) => r.storage_path as string);
      const { error } = await supabaseAdmin.storage.from(BUCKET).remove(cai);
      if (error) {
        // Bucata asta rămâne pentru rularea următoare: rândurile nu se șterg,
        // deci fișierele nu devin orfane. Un eșec parțial nu oprește restul.
        console.error("Storage a refuzat o bucată:", error);
        continue;
      }
      // Un fișier care nu mai era acolo e la fel de bine șters ca unul scos
      // acum; rândul lui trebuie să plece oricum, altfel s-ar reîncerca la
      // nesfârșit.
      fisiereSterse += cai.length;
      idReusite.push(...bucata.map((r) => r.id));
    }

    let randuriSterse = 0;
    if (idReusite.length) {
      const { data: sterse, error: eroareStergere } = await supabaseAdmin
        .from("announcement_attachments")
        .delete()
        .in("id", idReusite)
        .select("id");
      if (eroareStergere) {
        console.error("Nu am putut șterge rândurile:", eroareStergere);
        return new Response(
          JSON.stringify({ error: "delete_failed", fisiere_sterse: fisiereSterse }),
          { status: 500, headers: { "Content-Type": "application/json" } },
        );
      }
      randuriSterse = (sterse ?? []).length;
    }

    console.log(
      `Curățenie media: ${randuri.length} expirate, ${fisiereSterse} fișiere scoase, ${randuriSterse} rânduri șterse.`,
    );

    return new Response(
      JSON.stringify({
        verificate: randuri.length,
        fisiere_sterse: fisiereSterse,
        randuri_sterse: randuriSterse,
        // Când lotul e plin, mai sunt de făcut: rularea următoare le ia.
        mai_sunt: randuri.length === LOT,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }),
);
