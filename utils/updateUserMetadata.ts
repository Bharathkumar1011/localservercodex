import { supabaseAdmin } from "../supabaseClient";

export async function updateUserMetadata(userId: string, metadata: object) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    {
      user_metadata: metadata
    }
  );

  if (error) {
    console.error("Error updating user metadata:", error);
    throw error;
  }

  return data;
}
