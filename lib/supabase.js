import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dlqqynrbocpnwvpbwmgo.supabase.co";

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_gAZHWpcry9k7YQ73VGtA4A_Jz3qNKmo";

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey
);
