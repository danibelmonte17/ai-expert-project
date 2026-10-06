import { ProductGrid } from "@/components/product-grid";
import { listCatalogProducts } from "@/lib/catalog";

// Render por request: lee la base actual en vez de congelar el catalogo en build.
export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await listCatalogProducts();

  return <ProductGrid products={products} />;
}
