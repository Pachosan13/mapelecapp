#!/usr/bin/env node
/**
 * Loads .env.local and queries Supabase for the 4 core template IDs.
 * Paste the printed CORE_TEMPLATE_IDS line into .env.local.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = join(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const names = [
  "Mantenimiento – Bombas",
  "INSPECCIÓN PRUEBA Y MANTENIMIENTO DE SISTEMAS DE ROCIADORES NFPA25",
  "RECORRIDO CONTRA INCENDIO",
  "IPM DE BOMBA CONTRA INCENDIO NFPA25",
];

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY) in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key);
const { data: rows, error } = await supabase
  .from("visit_templates")
  .select("id,name")
  .in("name", names);

if (error) {
  console.error("Supabase error:", error.message);
  process.exit(1);
}

const ids = (rows ?? []).map((r) => r.id);
console.log("Add to .env.local:");
console.log("CORE_TEMPLATE_IDS=" + ids.join(","));
(rows ?? []).forEach((r) => console.log("  ", r.id, r.name));
