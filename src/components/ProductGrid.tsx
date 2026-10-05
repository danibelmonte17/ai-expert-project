import type { CatalogProduct } from "../lib/catalog";
import { ProductCard } from "./ProductCard";
import styles from "./ProductGrid.module.css";

interface ProductGridProps {
  products: CatalogProduct[];
}

/**
 * Cuadricula responsive del catalogo (`catalog-list`).
 *
 * 2 columnas en movil (<640px), 3 en tableta (640-1023px) y 4 en escritorio
 * (>=1024px), segun el Responsive Baseline de DESIGN.md. Con la lista vacia
 * muestra un estado amigable en lugar de una cuadricula vacia.
 */
export function ProductGrid({ products }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <p className={styles.empty}>
        No hay productos disponibles en este momento.
      </p>
    );
  }

  return (
    <ul className={styles.grid}>
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </ul>
  );
}
