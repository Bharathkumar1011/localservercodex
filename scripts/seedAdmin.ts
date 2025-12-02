import { updateUserMetadata } from "../utils/updateUserMetadata";

async function seedAdmin() {
  const userId = "32cb1c96-aa1e-4392-9b35-6efbe444b38c"; // Your UID

  const result = await updateUserMetadata(userId, {
    role: "admin",
    organization_id: "1"
  });

  console.log("Updated:", result);
}

seedAdmin();
