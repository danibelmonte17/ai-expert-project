import Image from "next/image";
import type { CatalogProduct } from "../lib/catalog";
import { formatPriceCents } from "../lib/format";
import styles from "./ProductGrid.module.css";

interface ProductCardProps {
  product: CatalogProduct;
}

/**
 * Tarjeta de producto del listado (`catalog-list`): imagen, nombre, categoria y
 * precio. Sin enlaces (la navegacion es `product-detail`), sin tallas ni badges.
 * Las imagenes del seed son SVG locales: `unoptimized` evita el optimizador
 * (que no procesa SVG por defecto).
 */
export function ProductCard({ product }: ProductCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.imageWrapper}>
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          unoptimized
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className={styles.image}
        />
      </div>
      <h2 className={styles.name}>{product.name}</h2>
      <span className={styles.category}>{product.category.name}</span>
      <span className={styles.price}>
        {formatPriceCents(product.priceCents, product.currency)}
      </span>
    </li>
  );
}
