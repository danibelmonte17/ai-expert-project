import { ProductGrid } from "../components/ProductGrid";
import { getCatalogProducts } from "../lib/catalog";

/**
 * Render dinamico: el listado refleja el estado de la base en cada peticion y
 * el build no depende de tener la base poblada.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  const products = await getCatalogProducts();

  return (
    <main className="container">
      <h1>Catálogo</h1>
      <ProductGrid products={products} />
    </main>
  );
}
