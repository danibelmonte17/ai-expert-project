"use client";

import Link from "next/link";
import { useState } from "react";
import type { CatalogProductDetail } from "@/lib/catalog";
import { formatPrice } from "@/lib/format";
import {
  colorsIn,
  nextSelection,
  resolveVariant,
  sizesIn,
  variantState,
  type VariantSelection,
} from "@/lib/variants";
import { VariantSelector } from "./variant-selector";
import styles from "./product-detail.module.css";

interface ProductDetailProps {
  product: CatalogProductDetail;
}

/**
 * Ficha de producto con selector de variante (product-detail).
 *
 * Primer componente cliente del repo: mantiene la seleccion talla/color en
 * estado local y deriva la variante, su estado de stock y el `disabled` del
 * CTA. No lee Prisma: recibe el DTO ya resuelto por el RSC. El boton
 * "Añadir al carrito" modela **solo su estado**; la accion real es de `cart-add`
 * (por eso no tiene handler).
 */
export function ProductDetail({ product }: ProductDetailProps) {
  const [selection, setSelection] = useState<VariantSelection>({});

  const sizes = sizesIn(product.variants);
  const colors = colorsIn(product.variants);
  const hasVariants = product.variants.length > 0;
  const selectedVariant =
    selection.size && selection.color
      ? resolveVariant(product.variants, selection.size, selection.color)
      : undefined;
  const isAvailable = selectedVariant !== undefined && selectedVariant.stock > 0;
  const priceCents = selectedVariant?.priceCents ?? product.priceCents;

  function handleSelectSize(size: string) {
    setSelection((previous) =>
      nextSelection(product.variants, previous, "size", size),
    );
  }

  function handleSelectColor(color: string) {
    setSelection((previous) =>
      nextSelection(product.variants, previous, "color", color),
    );
  }

  return (
    <main className={styles.page}>
      <Link className={styles.back} href="/">
        ← Volver al catálogo
      </Link>

      <div className={styles.layout}>
        <div className={styles.media}>
          {/* eslint-disable-next-line @next/next/no-img-element -- placeholders SVG locales; sin next/image por alcance */}
          <img
            className={styles.image}
            src={product.imageUrl}
            alt={product.name}
          />
        </div>

        <div className={styles.info}>
          <h1 className={styles.name}>{product.name}</h1>
          <p className={styles.category}>{product.categoryName}</p>
          <p className={styles.description}>{product.description}</p>
          <p className={styles.price}>
            {formatPrice(priceCents, product.currency)}
          </p>

          {hasVariants ? (
            <VariantSelector
              variants={product.variants}
              sizes={sizes}
              colors={colors}
              selectedSize={selection.size}
              selectedColor={selection.color}
              onSelectSize={handleSelectSize}
              onSelectColor={handleSelectColor}
            />
          ) : (
            <p className={styles.noVariants}>
              Este producto no tiene variantes disponibles.
            </p>
          )}

          <p className={styles.stockStatus} aria-live="polite">
            {selectedVariant ? (
              <>
                <span
                  className={
                    isAvailable ? styles.badgeAvailable : styles.badgeSoldOut
                  }
                >
                  {variantState(selectedVariant.stock)}
                </span>
                {isAvailable ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className={styles.stockCount}>
                      {selectedVariant.stock} en stock
                    </span>
                  </>
                ) : null}
              </>
            ) : (
              <span className={styles.stockHint}>
                Selecciona talla y color para ver el stock.
              </span>
            )}
          </p>

          <button type="button" className={styles.cta} disabled={!isAvailable}>
            Añadir al carrito
          </button>

          {/* Ancla try-on: aquí montarán `tryon-upload` / `tryon-result` (features posteriores). */}
        </div>
      </div>
    </main>
  );
}
