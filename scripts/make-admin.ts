import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

// Load environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("- EXPO_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

async function makeUserAdmin(email: string) {
  try {
    console.log(`Making user ${email} an admin...`);

    // First, find the user by email in auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error("Failed to list users:", authError);
      return;
    }

    const authUser = authData.users.find((u) => u.email === email);

    if (!authUser) {
      console.error(`User with email ${email} not found in auth.users`);
      return;
    }

    console.log(`Found user: ${authUser.id} (${authUser.email})`);

    // Update the user's profile to make them an admin
    const { data, error } = await supabase
      .from("users")
      .update({ is_admin: true })
      .eq("id", authUser.id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update user:", error);
      return;
    }

    console.log("✅ Successfully made user an admin!");
    console.log("User details:", {
      id: data.id,
      username: data.username,
      display_name: data.display_name,
      is_admin: data.is_admin,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
  }
}

// Get email from command line argument
const email = process.argv[2];

if (!email) {
  console.error("Usage: tsx scripts/make-admin.ts <email>");
  console.error("Example: tsx scripts/make-admin.ts matt@bedda.tech");
  process.exit(1);
}

makeUserAdmin(email);
