import type { CatalogProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import styles from "./product-card.module.css";

interface ProductCardProps {
  product: CatalogProduct;
}

/**
 * Tarjeta de producto del catalogo (catalog-list).
 *
 * Muestra exactamente imagen (con `alt` descriptivo), nombre, categoria y precio.
 * Sin enlace: las cards dejaran de ser estaticas en `product-detail`.
 */
export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className={styles.card}>
      {/* eslint-disable-next-line @next/next/no-img-element -- placeholders SVG locales; sin next/image por alcance */}
      <img className={styles.image} src={product.imageUrl} alt={product.name} />
      <div className={styles.body}>
        <h2 className={styles.name}>{product.name}</h2>
        <p className={styles.category}>{product.categoryName}</p>
        <p className={styles.price}>
          {formatPrice(product.priceCents, product.currency)}
        </p>
      </div>
    </article>
  );
}
