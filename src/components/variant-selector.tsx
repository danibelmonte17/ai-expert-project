import type { ProductVariant } from "@/lib/catalog";
import { isSelectable, isSoldOutOption } from "@/lib/variants";
import styles from "./variant-selector.module.css";

interface VariantSelectorProps {
  variants: ProductVariant[];
  sizes: string[];
  colors: string[];
  selectedSize?: string;
  selectedColor?: string;
  onSelectSize: (size: string) => void;
  onSelectColor: (color: string) => void;
}

interface VariantChipProps {
  value: string;
  selected: boolean;
  disabled: boolean;
  soldOut: boolean;
  onSelect: (value: string) => void;
}

function VariantChip({
  value,
  selected,
  disabled,
  soldOut,
  onSelect,
}: VariantChipProps) {
  const className = [
    styles.chip,
    soldOut ? styles.chipSoldOut : "",
    selected ? styles.chipSelected : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={className}
      aria-pressed={selected}
      disabled={disabled}
      data-sold-out={soldOut ? "true" : undefined}
      title={soldOut ? "Agotada" : undefined}
      onClick={() => onSelect(value)}
    >
      {value}
    </button>
  );
}

/**
 * Selector controlado de talla y color (product-detail).
 *
 * Respeta la matriz sparse: un chip sin combinacion posible con la seleccion
 * del otro eje queda `disabled`, y un chip cuyas combinaciones estan todas
 * agotadas se marca (pero sigue seleccionable para poder ver la variante
 * agotada). No guarda estado propio: la seleccion vive en `ProductDetail`.
 */
export function VariantSelector({
  variants,
  sizes,
  colors,
  selectedSize,
  selectedColor,
  onSelectSize,
  onSelectColor,
}: VariantSelectorProps) {
  return (
    <div className={styles.selector}>
      <div className={styles.group} role="group" aria-label="Talla">
        <span className={styles.legend}>Talla</span>
        <div className={styles.chips}>
          {sizes.map((size) => (
            <VariantChip
              key={size}
              value={size}
              selected={selectedSize === size}
              disabled={!isSelectable(variants, size, selectedColor)}
              soldOut={isSoldOutOption(variants, size, selectedColor)}
              onSelect={onSelectSize}
            />
          ))}
        </div>
      </div>

      <div className={styles.group} role="group" aria-label="Color">
        <span className={styles.legend}>Color</span>
        <div className={styles.chips}>
          {colors.map((color) => (
            <VariantChip
              key={color}
              value={color}
              selected={selectedColor === color}
              disabled={!isSelectable(variants, selectedSize, color)}
              soldOut={isSoldOutOption(variants, selectedSize, color)}
              onSelect={onSelectColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
