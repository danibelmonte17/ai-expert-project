import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import styles from "./product-card.module.css";

interface ProductCardProps {
  product: CatalogProduct;
}

/**
 * Tarjeta de producto del catalogo (catalog-list).
 *
 * Muestra imagen (con `alt` descriptivo), nombre, categoria y precio, y toda la
 * tarjeta enlaza a la ficha del producto (`/productos/[slug]`, product-detail).
 */
export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link className={styles.card} href={`/productos/${product.slug}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- placeholders SVG locales; sin next/image por alcance */}
      <img className={styles.image} src={product.imageUrl} alt={product.name} />
      <div className={styles.body}>
        <h2 className={styles.name}>{product.name}</h2>
        <p className={styles.category}>{product.categoryName}</p>
        <p className={styles.price}>
          {formatPrice(product.priceCents, product.currency)}
        </p>
      </div>
    </Link>
  );
}
