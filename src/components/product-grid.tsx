import type { CatalogProduct } from "@/lib/catalog";
import { ProductCard } from "./product-card";
import styles from "./product-grid.module.css";

interface ProductGridProps {
  products: CatalogProduct[];
}

/**
 * Listado de catalogo (catalog-list): `h1` + grid responsive de cards.
 *
 * Grid base 2 columnas (movil), 3 columnas desde 768px y 4 desde 1200px.
 * Con cero productos muestra un estado vacio amigable.
 */
export function ProductGrid({ products }: ProductGridProps) {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Catálogo</h1>
      {products.length === 0 ? (
        <p className={styles.empty}>No hay productos disponibles.</p>
      ) : (
        <ul className={styles.grid}>
          {products.map((product) => (
            <li className={styles.item} key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
