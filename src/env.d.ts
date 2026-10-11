/// <reference types="astro/client" />
import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";
declare global {
  namespace App {
    interface Locals {
      runtime: { env: { DB: D1Database }; ctx: ExecutionContext };
    }
  }
}
