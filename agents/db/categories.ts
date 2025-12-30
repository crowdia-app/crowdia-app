import { getSupabase } from "./client";

export async function findOrCreateCategory(categoryName: string): Promise<string | null> {
  if (!categoryName) return null;

  const slug = categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Try to find existing
  const { data: existing } = await getSupabase()
    .from("categories")
    .select("id")
    .or(`slug.eq.${slug},name.ilike.${categoryName}`)
    .single();

  if (existing) return existing.id;

  // Create new
  const { data, error } = await getSupabase()
    .from("categories")
    .insert({
      name: categoryName.charAt(0).toUpperCase() + categoryName.slice(1),
      slug,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create category:", error.message);
    return null;
  }

  return data.id;
}
